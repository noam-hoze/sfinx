"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import AuthGuard from "app/shared/components/AuthGuard";
import Header from "app/shared/components/Header";

export default function CompanySettingsPage() {
    const { data: session, update } = useSession();
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState("");
    const router = useRouter();

    const handleImageUpload = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            setMessage("Please select a valid image file.");
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setMessage("File size must be less than 5MB.");
            return;
        }

        setUploading(true);
        setMessage("");

        try {
            const formData = new FormData();
            formData.append("image", file);

            const response = await fetch("/api/upload/profile-image", {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                console.log("Upload successful, new image URL:", data.imageUrl);
                console.log("Updating session with new image...");

                // Update session with new image
                console.log("Updating session with new image URL...");
                await update({ image: data.imageUrl });
                console.log("Session updated with image:", data.imageUrl);

                setMessage("Profile image updated successfully!");
                console.log(
                    "Session updated! Avatar should refresh automatically"
                );
            } else {
                setMessage("Failed to upload image. Please try again.");
            }
        } catch (error) {
            setMessage("An error occurred. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <AuthGuard requiredRole="COMPANY">
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-4xl mx-auto px-6 py-8">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h1 className="text-2xl font-semibold text-gray-900">
                                Company Settings
                            </h1>
                        </div>

                        <div className="p-6">
                            <div className="space-y-6">
                                {/* Profile Image Section */}
                                <div>
                                    <h2 className="text-lg font-medium text-gray-900 mb-4">
                                        Profile Image
                                    </h2>
                                    <div className="flex items-center space-x-6">
                                        {/* Current Avatar */}
                                        <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden relative">
                                            {(session?.user as any)?.image ? (
                                                <Image
                                                    src={
                                                        (session?.user as any)
                                                            .image
                                                    }
                                                    alt="Profile"
                                                    fill
                                                    className="object-cover rounded-full"
                                                />
                                            ) : (
                                                <span className="text-2xl font-medium text-gray-700">
                                                    {(
                                                        session?.user as any
                                                    )?.name
                                                        ?.charAt(0)
                                                        ?.toUpperCase() ||
                                                        (
                                                            session?.user as any
                                                        )?.email
                                                            ?.charAt(0)
                                                            ?.toUpperCase()}
                                                </span>
                                            )}
                                        </div>

                                        {/* Upload Button */}
                                        <div>
                                            <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                                                <span>
                                                    {uploading
                                                        ? "Uploading..."
                                                        : "Change Image"}
                                                </span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageUpload}
                                                    className="sr-only"
                                                    disabled={uploading}
                                                />
                                            </label>
                                            <p className="mt-2 text-sm text-gray-500">
                                                JPG, PNG or GIF. Max size 5MB.
                                            </p>
                                        </div>
                                    </div>

                                    {message && (
                                        <div
                                            className={`mt-4 text-sm ${
                                                message.includes("successfully")
                                                    ? "text-green-600"
                                                    : "text-red-600"
                                            }`}
                                        >
                                            {message}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}
