import UnauthGuard from "app/shared/components/UnauthGuard";

export default function SignupLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <UnauthGuard>{children}</UnauthGuard>;
}
