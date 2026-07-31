import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import prisma from "lib/prisma";

vi.mock("next-auth", () => ({
    getServerSession: vi.fn(),
}));

vi.mock("lib/prisma", () => ({
    default: {
        user: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock("bcryptjs", () => ({
    default: {
        compare: vi.fn(),
        hash: vi.fn(),
    },
}));

describe("POST /api/auth/change-password", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return 401 if user is not authenticated", async () => {
        (getServerSession as any).mockResolvedValue(null);

        const req = new Request("http://localhost/api/auth/change-password", {
            method: "POST",
            body: JSON.stringify({
                currentPassword: "oldPassword123",
                newPassword: "newPassword123",
            }),
        });

        const res = await POST(req as any);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 if currentPassword or newPassword is missing", async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: "user-1" },
        });

        const req = new Request("http://localhost/api/auth/change-password", {
            method: "POST",
            body: JSON.stringify({
                currentPassword: "",
                newPassword: "newPassword123",
            }),
        });

        const res = await POST(req as any);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe("Both current password and new password are required.");
    });

    it("should return 400 if newPassword is too short", async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: "user-1" },
        });

        const req = new Request("http://localhost/api/auth/change-password", {
            method: "POST",
            body: JSON.stringify({
                currentPassword: "oldPassword123",
                newPassword: "123",
            }),
        });

        const res = await POST(req as any);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe("New password must be at least 6 characters long.");
    });

    it("should return 400 if current password is incorrect", async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: "user-1" },
        });

        (prisma.user.findUnique as any).mockResolvedValue({
            id: "user-1",
            password: "hashedOldPassword",
        });

        (bcrypt.compare as any).mockResolvedValue(false);

        const req = new Request("http://localhost/api/auth/change-password", {
            method: "POST",
            body: JSON.stringify({
                currentPassword: "wrongPassword",
                newPassword: "newPassword123",
            }),
        });

        const res = await POST(req as any);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe("Current password is incorrect.");
    });

    it("should update password and return 200 on success", async () => {
        (getServerSession as any).mockResolvedValue({
            user: { id: "user-1" },
        });

        (prisma.user.findUnique as any).mockResolvedValue({
            id: "user-1",
            password: "hashedOldPassword",
        });

        (bcrypt.compare as any).mockResolvedValue(true);
        (bcrypt.hash as any).mockResolvedValue("hashedNewPassword");
        (prisma.user.update as any).mockResolvedValue({ id: "user-1" });

        const req = new Request("http://localhost/api/auth/change-password", {
            method: "POST",
            body: JSON.stringify({
                currentPassword: "correctOldPassword",
                newPassword: "newPassword123",
            }),
        });

        const res = await POST(req as any);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.message).toBe("Password updated successfully.");
        expect(bcrypt.hash).toHaveBeenCalledWith("newPassword123", 12);
        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user-1" },
            data: { password: "hashedNewPassword" },
        });
    });
});
