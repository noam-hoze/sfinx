import UnauthGuard from "../../lib/components/UnauthGuard";

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <UnauthGuard>{children}</UnauthGuard>;
}
