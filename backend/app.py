import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.security import check_password_hash, generate_password_hash

load_dotenv()

app = Flask(__name__)
CORS(app)

# In-memory user store (replace with a real DB in production)
users = {}


def get_request_json():
    data = request.get_json(silent=True)
    if isinstance(data, dict):
        return data, None
    return None, (jsonify({'message': 'Request body must be valid JSON.'}), 400)


def serialize_user(user_record):
    return {
        'fullName': user_record['fullName'],
        'email': user_record['email'],
        'age': user_record['age'],
        'occupation': user_record['occupation'],
    }


# ---------------------------------------------------------------------------
# Registration endpoint
# POST /api/register
# ---------------------------------------------------------------------------
@app.route('/api/register', methods=['POST'])
def register():
    data, error_response = get_request_json()
    if error_response:
        return error_response

    full_name = data.get('fullName', '').strip()
    age = data.get('age')
    occupation = data.get('occupation', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    # Basic validation
    if not all([full_name, age, occupation, email, password]):
        return jsonify({'message': 'All fields are required.'}), 400

    try:
        age_number = int(age)
        if not (10 <= age_number <= 100):
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({'message': 'Age must be between 10 and 100.'}), 400

    if email in users:
        return jsonify({'message': 'An account with this email already exists.'}), 409

    users[email] = {
        'fullName': full_name,
        'age': age_number,
        'occupation': occupation,
        'email': email,
        'password': generate_password_hash(password, method='pbkdf2:sha256'),
    }

    return jsonify({
        'message': 'Account created successfully!',
        'user': serialize_user(users[email])
    }), 201


# ---------------------------------------------------------------------------
# Login endpoint
# POST /api/login
# ---------------------------------------------------------------------------
@app.route('/api/login', methods=['POST'])
def login():
    data, error_response = get_request_json()
    if error_response:
        return error_response

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'message': 'Email and password are required.'}), 400

    user = users.get(email)

    if user is None or not check_password_hash(user['password'], password):
        return jsonify({'message': 'Invalid email or password.'}), 401

    return jsonify({
        'message': 'Login successful!',
        'user': serialize_user(user)
    }), 200


# ---------------------------------------------------------------------------
# Health check
# GET /api/health
# ---------------------------------------------------------------------------
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'backend': 'Flask'}), 200


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    debug_mode = os.getenv('FLASK_DEBUG', '1') == '1'
    print(f"Flask server running on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug_mode, use_reloader=False)
