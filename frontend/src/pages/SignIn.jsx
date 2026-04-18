import { useNavigate } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import AuthShell from '../components/AuthShell';

export default function SignIn() {
    const navigate = useNavigate();

    return (
        <AuthShell
            eyebrow="FocusFlow Access"
            title={<>Focus.<br />Track.<br />Grow.</>}
            description="Sign back in to your personal dashboard for deep-work sessions, study logs, sleep rhythm, and weekly momentum."
            panelTitle="Weekly Momentum"
            panelDescription="A quick read on your focus hours, streak health, and recovery balance before you step back into the dashboard."
            footer="Study, sleep, and focus signals in one premium workspace"
        >
            <AuthCard
                mode="signin"
                onSwitchMode={() => navigate('/signup')}
                onSuccess={() => navigate('/')}
            />
        </AuthShell>
    );
}
