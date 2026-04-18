import { useNavigate } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import AuthShell from '../components/AuthShell';

export default function SignUp() {
    const navigate = useNavigate();

    return (
        <AuthShell
            eyebrow="FocusFlow Setup"
            title={<>Build Your<br />Focus System</>}
            description="Create your account to track deep-work sessions, study time, sleep patterns, and the small routines that shape better days."
            panelTitle="Starter Overview"
            panelDescription="FocusFlow turns daily routines into a clear rhythm with one place for sessions, recovery, and long-term consistency."
            footer="Made for deep work, study routines, and sustainable progress"
        >
            <AuthCard
                mode="signup"
                onSwitchMode={() => navigate('/signin')}
                onSuccess={() => navigate('/')}
            />
        </AuthShell>
    );
}
