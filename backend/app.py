import logging
import os
import re
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'frontend', '.env.local'))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, origins=os.getenv('ALLOWED_ORIGINS', '*'))
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["100 per hour", "20 per minute"],
    storage_uri="memory://"
)

AI_MODEL = os.getenv('OPENROUTER_MODEL', os.getenv('GEMINI_MODEL', 'google/gemini-2.5-flash')).strip()
AI_KEY = os.getenv('OPENROUTER_API_KEY', os.getenv('GEMINI_API_KEY', '')).strip()
AI_URL = os.getenv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1/chat/completions').strip()
AI_HEADERS = {
    'Authorization': f'Bearer {AI_KEY}',
    'Content-Type': 'application/json',
    'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'http://localhost:5173').strip(),
    'X-Title': os.getenv('OPENROUTER_APP_NAME', 'FocusFlow').strip(),
}
SUPABASE_URL = os.getenv('SUPABASE_URL', os.getenv('VITE_SUPABASE_URL', '')).rstrip('/')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', os.getenv('VITE_SUPABASE_ANON_KEY', '')).strip()
MAX_MSG_LENGTH = 500
UUID_RE = re.compile(r'^[0-9a-f-]{36}$', re.IGNORECASE)
PROGRESS_KEYWORDS = {
    'full report',
    'progress',
    'progress report',
    'report',
    'show full report',
    'weekly progress',
    'weekly report',
    'show my progress',
    'show my report',
}
TODAY_FOCUS_RE = re.compile(
    r'\b(?:today|today\'s)\b(?=.*\bfocus\b)|\bfocus\b(?=.*\b(?:today|today\'s)\b)',
    re.IGNORECASE
)
GOAL_HOURS = {'beginner': 15, 'average': 25, 'intensive': 40}
SYSTEM_PROMPT = (
    "You are FocusFlow AI Coach. Only answer focus, study, sleep, distraction, and productivity questions. "
    "Use the user's current stats exactly when helpful; never invent, estimate, or reuse older totals from chat history. "
    "Keep replies short, practical, and easy to follow. "
    "Lead with one clear next step in plain text without labels like 'Next step:' and without markdown or bullet points. "
    "Do not mention recent sessions or session names unless the user explicitly asks for session history. "
    "Do not give long numbered plans unless the user explicitly asks for a detailed routine. "
    "Give a small detailed plan under 80 words with encouragement if the user asks how to improve."
)


def json_body():
    data = request.get_json(silent=True)
    if isinstance(data, dict):
        return data
    return None


def text(value, default=''):
    return str(value or default).strip()


def seconds_label(value):
    value = int(value or 0)
    if value < 60:
        return f"{value} sec"
    if value < 3600:
        return f"{value // 60} min {value % 60} sec"
    return f"{value / 3600:.1f} hrs"


def min_sec_label(value):
    value = max(0, int(value or 0))
    return f"{value // 60} min {value % 60} sec"


def hours_label(value):
    return f"{int(value or 0) / 3600:.1f} hrs"


def parse_time(value):
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except Exception:
        return None


def normalize(message):
    return re.sub(r'\s+', ' ', text(message).lower())


def is_progress_request(message):
    normalized = normalize(message)
    return normalized in PROGRESS_KEYWORDS or any(
        phrase in normalized
        for phrase in ('full report', 'progress report', 'weekly report', 'show my progress', 'show my report')
    )


def is_today_focus_request(message):
    normalized = normalize(message)
    return bool(TODAY_FOCUS_RE.search(normalized)) and any(
        keyword in normalized
        for keyword in ('total', 'how much', 'show', 'what', 'report', 'stats', 'time')
    )


def valid_uuid(value):
    value = text(value)
    return value if UUID_RE.match(value) else None


def bearer_token(data):
    auth = request.headers.get('Authorization', '')
    if auth.lower().startswith('bearer '):
        return auth.split(' ', 1)[1]
    return text(data.get('accessToken'))


def timezone_offset_minutes(data):
    try:
        return int(data.get('timezoneOffsetMinutes') or 0)
    except (TypeError, ValueError):
        return 0


def positive_int(value):
    try:
        parsed = int(value)
        return parsed if parsed >= 0 else None
    except (TypeError, ValueError):
        return None


def to_client_time(value, offset_minutes=0):
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc) - timedelta(minutes=offset_minutes)


def stat(stats, *keys, default=''):
    for key in keys:
        value = text(stats.get(key))
        if value:
            return value
    return default


def remove_recent_session_sentences(value):
    return re.sub(
        r'\s*(?:your\s+)?recent\s+(?:focus\s+)?sessions?\s+(?:were|are|include|included)\s+[^.?!]*(?:[.?!]|$)',
        ' ',
        text(value),
        flags=re.IGNORECASE
    )


def plain_ai_text(value):
    cleaned = remove_recent_session_sentences(text(value).replace('*', ''))
    return re.sub(r'\s{2,}', ' ', cleaned).strip()


def recent_session_phrase(value):
    name, separator, duration = text(value).partition(':')
    if separator and text(duration):
        return f"{text(name, 'Focus')} for {text(duration)}"
    return text(value)


def sentence_join(items):
    items = [text(item) for item in items if text(item)]
    if not items:
        return ''
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return f"{', '.join(items[:-1])}, and {items[-1]}"


def build_progress_report(stats, recent):
    goal_target = stat(stats, 'goalTarget', default='25 hrs this week')
    goal_hours = goal_target.split(' ', 1)[0] if goal_target else '25'
    focus_date = stat(stats, 'focusDate', default='today')
    weekly_focus = stat(stats, 'weeklyFocus', default='0.0 hrs')
    weekly_study = stat(stats, 'weeklyStudy', default='0.0 hrs')
    weekly_sleep = stat(stats, 'weeklySleep', default='0.0 hrs')
    weekly_distraction = stat(stats, 'weeklyDistraction', default='0 sec')

    return (
        f"Here is your full FocusFlow report for {focus_date}. Today you focused for {stat(stats, 'focusTime', default='0 sec')}, "
        f"studied for {stat(stats, 'studyTime', default='0.0 hrs')}, slept for {stat(stats, 'sleepTime', default='0.0 hrs')}, "
        f"and had {stat(stats, 'distractedTime', default='0 sec')} of distraction. "
        f"This week you have completed {weekly_focus} of focus, {weekly_study} of study, {weekly_sleep} of sleep, "
        f"and {weekly_distraction} of distraction. "
        f"That puts you at {stat(stats, 'weeklyProgress', default='0%')} of your {goal_hours} hour goal. "
        "Keep going at a steady pace."
    )


def ai_progress_report_reply(stats, recent):
    prompt = (
        "Write a natural full FocusFlow report using these exact values. "
        f"Date: {stat(stats, 'focusDate', default='today')}. "
        f"Today: focus {stat(stats, 'focusTime', default='0 sec')}, "
        f"study {stat(stats, 'studyTime', default='0.0 hrs')}, "
        f"sleep {stat(stats, 'sleepTime', default='0.0 hrs')}, "
        f"distraction {stat(stats, 'distractedTime', default='0 sec')}. "
        f"This week: focus {stat(stats, 'weeklyFocus', default='0.0 hrs')}, "
        f"study {stat(stats, 'weeklyStudy', default='0.0 hrs')}, "
        f"sleep {stat(stats, 'weeklySleep', default='0.0 hrs')}, "
        f"distraction {stat(stats, 'weeklyDistraction', default='0 sec')}. "
        f"Weekly goal progress: {stat(stats, 'weeklyProgress', default='0%')} of "
        f"{stat(stats, 'goalTarget', default='25 hrs this week')}. "
        "Include both the daily report and weekly report. Do not change, round, or omit any time value. "
        "Keep it warm, clear, and under 95 words. No markdown or bullets."
    )
    return ai_reply(prompt, stats, recent, [], False)


def build_today_focus_report(stats):
    return (
        f"Today ({stat(stats, 'focusDate', default='your local date')}) "
        f"your total focus time is {stat(stats, 'focusTime', default='0 sec')}."
    )


def summarize_logs(logs, preset='average', offset_minutes=0):
    now = to_client_time(datetime.now(timezone.utc), offset_minutes)
    today = now.date()
    week_start = today - timedelta(days=6)
    totals = {
        'focus_today': 0,
        'focus_week': 0,
        'study_today': 0,
        'study_week': 0,
        'sleep_today': 0,
        'sleep_week': 0,
        'distracted_today': 0,
        'distracted_week': 0,
    }
    recent = []

    for log in logs:
        when = to_client_time(parse_time(log.get('timestamp')), offset_minutes)
        if not when:
            continue

        log_type = text(log.get('type_id'))
        duration = int(log.get('duration_secs') or 0)
        distracted = int(log.get('distracted_secs') or 0)
        log_date = when.date()

        if log_type == 'focus':
            if log_date == today:
                totals['focus_today'] += duration
                totals['distracted_today'] += distracted
            if week_start <= log_date <= today:
                totals['focus_week'] += duration
                totals['distracted_week'] += distracted
            recent.append(f"{text(log.get('session_name'), 'Focus')}: {seconds_label(duration)}")
        elif log_type == 'study':
            if log_date == today:
                totals['study_today'] += duration
            if week_start <= log_date <= today:
                totals['study_week'] += duration
        elif log_type == 'sleep':
            if log_date == today:
                totals['sleep_today'] += duration
            if week_start <= log_date <= today:
                totals['sleep_week'] += duration

    goal_hours = GOAL_HOURS.get(preset, GOAL_HOURS['average'])
    weekly_hours = totals['focus_week'] / 3600
    progress = min(100, round((weekly_hours / goal_hours) * 100)) if goal_hours else 0
    stats = {
        'focusDate': today.isoformat(),
        'focusTime': seconds_label(totals['focus_today']),
        'studyTime': hours_label(totals['study_today']),
        'sleepTime': hours_label(totals['sleep_today']),
        'distractedTime': seconds_label(totals['distracted_today']),
        'weeklyFocus': hours_label(totals['focus_week']),
        'weeklyStudy': hours_label(totals['study_week']),
        'weeklySleep': hours_label(totals['sleep_week']),
        'weeklyDistraction': seconds_label(totals['distracted_week']),
        'weeklyProgress': f"{progress}%",
        'goalTarget': f"{goal_hours} hrs this week",
    }
    return stats, recent[:3]


def summarize_focus_session_report(logs, session_log, offset_minutes=0):
    now = to_client_time(datetime.now(timezone.utc), offset_minutes)
    today = now.date()
    session_id = text(session_log.get('id'))
    current_focus = int(session_log.get('duration_secs') or 0)
    current_distraction = int(session_log.get('distracted_secs') or 0)
    previous_focus = 0
    previous_distraction = 0

    for log in logs:
        if text(log.get('type_id')) != 'focus':
            continue
        if text(log.get('id')) == session_id:
            continue

        when = to_client_time(parse_time(log.get('timestamp')), offset_minutes)
        if not when or when.date() != today:
            continue

        log_focus = int(log.get('duration_secs') or 0)
        log_distraction = int(log.get('distracted_secs') or 0)
        previous_focus += log_focus
        previous_distraction += log_distraction

    today_focus = previous_focus + current_focus
    today_distraction = previous_distraction + current_distraction

    return {
        'sessionName': text(session_log.get('session_name'), 'Focus session'),
        'durationSecs': current_focus,
        'focusSecs': current_focus,
        'distractionSecs': current_distraction,
        'previousTodayFocusSecs': previous_focus,
        'previousTodayDistractionSecs': previous_distraction,
        'todayFocusSecs': today_focus,
        'todayDistractionSecs': today_distraction,
        'todayEffectiveFocusSecs': today_focus,
    }


def apply_client_session_totals(report, data):
    focus_today = positive_int(data.get('focusTodaySecs'))
    distraction_today = positive_int(data.get('distractionTodaySecs'))
    if focus_today is None and distraction_today is None:
        return report

    next_report = dict(report)
    if focus_today is not None:
        next_report['todayFocusSecs'] = max(int(report.get('todayFocusSecs') or 0), focus_today)
        next_report['previousTodayFocusSecs'] = max(
            0,
            next_report['todayFocusSecs'] - int(report.get('focusSecs') or 0)
        )

    if distraction_today is not None:
        next_report['todayDistractionSecs'] = max(int(report.get('todayDistractionSecs') or 0), distraction_today)
        next_report['previousTodayDistractionSecs'] = max(
            0,
            next_report['todayDistractionSecs'] - int(report.get('distractionSecs') or 0)
        )

    next_report['todayEffectiveFocusSecs'] = next_report['todayFocusSecs']
    return next_report


def fetch_user_logs(token, user_id, session_id=None):
    if not (SUPABASE_URL and SUPABASE_ANON_KEY and token and user_id):
        return None

    params = {
        'select': 'id,source,type_id,duration_secs,distracted_secs,session_name,timestamp',
        'user_id': f'eq.{user_id}',
    }
    if session_id:
        params['id'] = f'eq.{text(session_id)}'

    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/logs",
        headers={'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {token}'},
        params=params,
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def build_prompt(message, stats, recent, history, progress_request=False):
    user_message = message if not progress_request else f"{message}\n\nThe user is asking for a progress update."
    history_text = '\n'.join(
        f"- {entry.get('role', 'user')}: {plain_ai_text(entry.get('text'))}"
        for entry in history
        if isinstance(entry, dict) and plain_ai_text(entry.get('text'))
    ) or '- No previous chat context.'

    return (
        "Current stats are authoritative and override any older totals in History. "
        "They were calculated from the user's logs with the same local-day timestamp method as the dashboard.\n"
        f"Local date for today's totals: {stat(stats, 'focusDate', default='today')}.\n"
        f"Stats: focus today {stat(stats, 'focusTime', default='0 min')}, study today {stat(stats, 'studyTime', default='0 hrs')}, "
        f"sleep today {stat(stats, 'sleepTime', default='0 hrs')}, distraction today {stat(stats, 'distractedTime', default='0 min')}, "
        f"weekly focus {stat(stats, 'weeklyFocus', default='0 hrs')}, weekly study {stat(stats, 'weeklyStudy', default='0 hrs')}, "
        f"weekly sleep {stat(stats, 'weeklySleep', default='0 hrs')}, weekly distraction {stat(stats, 'weeklyDistraction', default='0 min')}, "
        f"weekly progress {stat(stats, 'weeklyProgress', default='0%')}, "
        f"goal {stat(stats, 'goalTarget', default='25 hrs this week')}.\n"
        f"History:\n{history_text}\n\n"
        f"User message: {user_message}"
    )


def ai_reply(message, stats, recent, history, progress_request=False):
    response = requests.post(
        AI_URL,
        headers=AI_HEADERS,
        json={
            'model': AI_MODEL,
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': build_prompt(message, stats, recent, history, progress_request)},
            ],
            'temperature': 0.35,
            'max_tokens': 400,
        },
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()
    return plain_ai_text(data['choices'][0]['message']['content'])


def session_report_reply(session_log, stats, recent):
    duration = int(session_log.get('duration_secs') or 0)
    distracted = int(session_log.get('distracted_secs') or 0)
    focus = max(0, duration - distracted)
    session_name = text(session_log.get('session_name'), 'focus session')
    report = (
        f"Congratulate the user for finishing '{session_name}'. "
        f"Use these exact min.sec accurate session numbers: total session {min_sec_label(duration)}, "
        f"focused time {min_sec_label(focus)}, distraction time {min_sec_label(distracted)}. "
        f"Also include today's total focus {stat(stats, 'focusTime', default='0 min')} and today's total distraction "
        f"{stat(stats, 'distractedTime', default='0 min')}. "
        "Do not round any time value or drop seconds. Keep it warm, specific, under 90 words, and do not use markdown."
    )
    return ai_reply(report, stats, recent, [], False)


def ai_session_report_reply(report):
    prompt = (
        f"The user finished a focus session named '{report['sessionName']}'. "
        f"Write a warm, natural coach message. Use these exact numbers without changing them: "
        f"session focus {min_sec_label(report['focusSecs'])}, "
        f"session distraction {min_sec_label(report['distractionSecs'])}, "
        f"today total focus {min_sec_label(report['todayFocusSecs'])}, "
        f"today total distraction {min_sec_label(report['todayDistractionSecs'])}. "
        "Do not use a rigid report format, markdown, bullets, or colon-separated labels. "
        "Keep it under 55 words."
    )
    stats = {
        'focusDate': to_client_time(datetime.now(timezone.utc)).date().isoformat(),
        'focusTime': min_sec_label(report['todayFocusSecs']),
        'distractedTime': min_sec_label(report['todayDistractionSecs']),
    }
    return ai_reply(prompt, stats, [], [], False)


def exact_session_report_sentence(report):
    return (
        f"You focused for {min_sec_label(report['focusSecs'])} in this session "
        f"with {min_sec_label(report['distractionSecs'])} distracted."
    )


def fallback_session_report(session_log, stats):
    focus = int(session_log.get('duration_secs') or 0)
    distracted = int(session_log.get('distracted_secs') or 0)
    duration = focus + distracted
    session_name = text(session_log.get('session_name'), 'focus session')
    return fallback_report_from_summary({
        'sessionName': session_name,
        'durationSecs': duration,
        'focusSecs': focus,
        'distractionSecs': distracted,
        'previousTodayFocusSecs': 0,
        'previousTodayDistractionSecs': 0,
        'todayFocusSecs': duration,
        'todayDistractionSecs': distracted,
    })


def fallback_report_from_summary(report):
    return (
        f"Great work finishing {report['sessionName']}. {exact_session_report_sentence(report)}"
    )


@app.route('/api/ai/coach', methods=['POST'])
@limiter.limit("30 per minute")
def coach():
    data = json_body()
    if data is None:
        return jsonify({'message': 'Invalid JSON'}), 400

    message = text(data.get('message'))[:MAX_MSG_LENGTH]
    if not message:
        return jsonify({'reply': 'What do you want to focus on?'})

    stats = data.get('stats', {}) if isinstance(data.get('stats'), dict) else {}
    recent = data.get('recentSessions', []) if isinstance(data.get('recentSessions'), list) else []
    history = data.get('history', []) if isinstance(data.get('history'), list) else []
    progress_request = is_progress_request(message)
    today_focus_request = is_today_focus_request(message)
    offset_minutes = timezone_offset_minutes(data)
    user_id = valid_uuid(data.get('userId'))
    token = bearer_token(data)

    try:
        user_logs = fetch_user_logs(token, user_id)
        if user_logs is not None:
            stats, recent = summarize_logs(user_logs, offset_minutes=offset_minutes)
    except requests.RequestException as error:
        logger.warning("Supabase log fetch failed: %s", error)
    except Exception:
        logger.exception("Unexpected Supabase error")
    if progress_request:
        try:
            return jsonify({'reply': ai_progress_report_reply(stats, recent)})
        except requests.RequestException as error:
            logger.error("OpenRouter progress report failed: %s", error)
            return jsonify({'reply': build_progress_report(stats, recent)})
        except (KeyError, IndexError, TypeError):
            logger.exception("Unexpected OpenRouter progress report response")
            return jsonify({'reply': build_progress_report(stats, recent)})
    if today_focus_request:
        return jsonify({'reply': build_today_focus_report(stats)})
    try:
        return jsonify({'reply': ai_reply(message, stats, recent, history, progress_request)})
    except requests.RequestException as error:
        logger.error("OpenRouter request failed: %s", error)
        return jsonify({'message': 'AI service request failed.'}), 502
    except (KeyError, IndexError, TypeError):
        logger.exception("Unexpected OpenRouter response")
        return jsonify({'message': 'AI service returned an unexpected response.'}), 502
    except Exception:
        logger.exception("Unexpected AI error")
        return jsonify({'message': 'AI service returned an error.'}), 500


@app.route('/api/ai/session-report', methods=['POST'])
@limiter.limit("20 per minute")
def session_report():
    data = json_body()
    if data is None:
        return jsonify({'message': 'Invalid JSON'}), 400

    user_id = valid_uuid(data.get('userId'))
    session_id = text(data.get('sessionId'))
    offset_minutes = timezone_offset_minutes(data)
    if not (user_id and session_id):
        return jsonify({'message': 'A user and session are required.'}), 400

    try:
        token = bearer_token(data)
        user_logs = fetch_user_logs(token, user_id)
        if user_logs is None:
            return jsonify({'message': 'Database access is not configured.'}), 400

        session_log = next(
            (
                log for log in user_logs
                if text(log.get('id')) == session_id
                and text(log.get('source')) == 'session'
                and text(log.get('type_id')) == 'focus'
            ),
            None
        )
        if not session_log:
            return jsonify({'message': 'Session report data was not found.'}), 404

        stats, recent = summarize_logs(user_logs, offset_minutes=offset_minutes)
        report_summary = summarize_focus_session_report(user_logs, session_log, offset_minutes=offset_minutes)
        report_summary = apply_client_session_totals(report_summary, data)
    except requests.RequestException as error:
        logger.warning("Supabase session report fetch failed: %s", error)
        return jsonify({'message': 'Unable to fetch session report data.'}), 502
    except Exception:
        logger.exception("Unexpected session report data error")
        return jsonify({'message': 'Unable to build the session report.'}), 500

    try:
        reply = ai_session_report_reply(report_summary)
    except requests.RequestException as error:
        logger.error("OpenRouter session report failed: %s", error)
        reply = fallback_report_from_summary(report_summary)
    except (KeyError, IndexError, TypeError):
        logger.exception("Unexpected OpenRouter session report response")
        reply = fallback_report_from_summary(report_summary)

    return jsonify({
        'reply': reply,
        'report': {
            'sessionName': report_summary['sessionName'],
            'duration': min_sec_label(report_summary['durationSecs']),
            'focus': min_sec_label(report_summary['focusSecs']),
            'distraction': min_sec_label(report_summary['distractionSecs']),
            'previousTodayFocus': min_sec_label(report_summary['previousTodayFocusSecs']),
            'previousTodayDistraction': min_sec_label(report_summary['previousTodayDistractionSecs']),
            'todayFocus': min_sec_label(report_summary['todayFocusSecs']),
            'todayDistraction': min_sec_label(report_summary['todayDistractionSecs']),
            'todayEffectiveFocus': min_sec_label(report_summary['todayEffectiveFocusSecs']),
        }
    })


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    app.run(port=int(os.getenv('PORT', '5001')), debug=os.getenv('FLASK_DEBUG', 'false').lower() == 'true')
