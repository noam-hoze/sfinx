"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function SignupPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [role, setRole] = useState<"CANDIDATE" | "COMPANY">("CANDIDATE");
    const [companyName, setCompanyName] = useState("");
    const [companySize, setCompanySize] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [location, setLocation] = useState("");
    const [bio, setBio] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords don't match");
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    role,
                    companyName: role === "COMPANY" ? companyName : undefined,
                    companySize: role === "COMPANY" ? companySize : undefined,
                    jobTitle: role === "CANDIDATE" ? jobTitle : undefined,
                    location,
                    bio,
                }),
            });

            if (response.ok) {
                router.push("/login?message=Account created successfully");
            } else {
                const data = await response.json();
                setError(data.error || "An error occurred");
            }
        } catch (error) {
            setError("An error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md animate-fade-in">
                {/* Logo */}
                <div className="text-center mb-4 animate-slide-up">
                    <Image
                        src="/logos/sfinx_logo_diagonal.svg"
                        alt="Sfinx Logo"
                        width={160}
                        height={160}
                        className="w-40 h-40 object-contain mx-auto scale-[2.5]"
                    />
                </div>

                {/* Signup Form */}
                <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/20 shadow-xl p-8 animate-slide-up-delayed">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSignup} className="space-y-6">
                        {/* Account Type Selection */}
                        <div className="animate-slide-up-delayed-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Account Type
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setRole("CANDIDATE")}
                                    className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                                        role === "CANDIDATE"
                                            ? "border-blue-500 bg-blue-50 text-blue-700"
                                            : "border-gray-200 bg-white/50 text-gray-700 hover:border-gray-300"
                                    }`}
                                >
                                    <div className="text-center">
                                        <div className="w-8 h-8 mx-auto mb-2 bg-blue-500 rounded-full flex items-center justify-center">
                                            <svg
                                                className="w-4 h-4 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                        <div className="font-medium">
                                            Candidate
                                        </div>
                                        <div className="text-xs opacity-75">
                                            Find your dream job
                                        </div>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole("COMPANY")}
                                    className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                                        role === "COMPANY"
                                            ? "border-blue-500 bg-blue-50 text-blue-700"
                                            : "border-gray-200 bg-white/50 text-gray-700 hover:border-gray-300"
                                    }`}
                                >
                                    <div className="text-center">
                                        <div className="w-8 h-8 mx-auto mb-2 bg-green-500 rounded-full flex items-center justify-center">
                                            <svg
                                                className="w-4 h-4 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 2a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                        <div className="font-medium">
                                            Company
                                        </div>
                                        <div className="text-xs opacity-75">
                                            Hire top talent
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Name Field */}
                        <div className="animate-slide-up-delayed-3">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm"
                                placeholder="Enter your full name"
                                required
                            />
                        </div>

                        {/* Email Field */}
                        <div className="animate-slide-up-delayed-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm"
                                placeholder="Enter your email"
                                required
                            />
                        </div>

                        {/* Conditional Fields Based on Account Type */}
                        {role === "COMPANY" && (
                            <>
                                {/* Company Name */}
                                <div className="animate-slide-up-delayed-5">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Company Name
                                    </label>
                                    <input
                                        type="text"
                                        value={companyName}
                                        onChange={(e) =>
                                            setCompanyName(e.target.value)
                                        }
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm"
                                        placeholder="Enter your company name"
                                        required
                                    />
                                </div>

                                {/* Company Size */}
                                <div className="animate-slide-up-delayed-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Company Size
                                    </label>
                                    <select
                                        value={companySize}
                                        onChange={(e) =>
                                            setCompanySize(e.target.value)
                                        }
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm"
                                    >
                                        <option value="">
                                            Select company size
                                        </option>
                                        <option value="STARTUP">
                                            Startup (1-10 employees)
                                        </option>
                                        <option value="SMALL">
                                            Small (11-50 employees)
                                        </option>
                                        <option value="MEDIUM">
                                            Medium (51-200 employees)
                                        </option>
                                        <option value="LARGE">
                                            Large (201-1000 employees)
                                        </option>
                                        <option value="ENTERPRISE">
                                            Enterprise (1000+ employees)
                                        </option>
                                    </select>
                                </div>
                            </>
                        )}

                        {role === "CANDIDATE" && (
                            /* Job Title */
                            <div className="animate-slide-up-delayed-5">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Job Title
                                </label>
                                <input
                                    type="text"
                                    value={jobTitle}
                                    onChange={(e) =>
                                        setJobTitle(e.target.value)
                                    }
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm"
                                    placeholder="e.g. Software Engineer, Product Manager"
                                />
                            </div>
                        )}

                        {/* Location */}
                        <div
                            className={`animate-slide-up-delayed-${
                                role === "COMPANY" ? "7" : "6"
                            }`}
                        >
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Location
                            </label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm"
                                placeholder={
                                    role === "COMPANY"
                                        ? "Company headquarters location"
                                        : "Your current location"
                                }
                            />
                        </div>

                        {/* Bio */}
                        <div
                            className={`animate-slide-up-delayed-${
                                role === "COMPANY" ? "8" : "7"
                            }`}
                        >
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Bio
                            </label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm resize-none"
                                placeholder={
                                    role === "COMPANY"
                                        ? "Tell candidates about your company culture and values"
                                        : "Tell employers about yourself and your career goals"
                                }
                                rows={3}
                            />
                        </div>

                        {/* Password Field */}
                        <div
                            className={`animate-slide-up-delayed-${
                                role === "COMPANY" ? "9" : "8"
                            }`}
                        >
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm"
                                placeholder="Create a password"
                                required
                            />
                        </div>

                        {/* Confirm Password Field */}
                        <div
                            className={`animate-slide-up-delayed-${
                                role === "COMPANY" ? "10" : "9"
                            }`}
                        >
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm"
                                placeholder="Confirm your password"
                                required
                            />
                        </div>

                        {/* Signup Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] animate-slide-up-delayed-${
                                role === "COMPANY" ? "11" : "10"
                            }`}
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                                    Creating account...
                                </div>
                            ) : (
                                "Create Account"
                            )}
                        </button>
                    </form>
                </div>

                {/* Login Link */}
                <div className="text-center mt-6">
                    <p className="text-gray-600">
                        Already have an account?{" "}
                        <Link
                            href="/login"
                            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                        >
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>

            <style jsx>{`
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .animate-fade-in {
                    animation: fadeIn 0.6s ease-out;
                }

                .animate-slide-up {
                    animation: slideUp 0.8s ease-out 0.2s both;
                }

                .animate-slide-up-delayed {
                    animation: slideUp 0.8s ease-out 0.4s both;
                }

                .animate-slide-up-delayed-2 {
                    animation: slideUp 0.8s ease-out 0.6s both;
                }

                .animate-slide-up-delayed-3 {
                    animation: slideUp 0.8s ease-out 0.8s both;
                }

                .animate-slide-up-delayed-4 {
                    animation: slideUp 0.8s ease-out 1s both;
                }

                .animate-slide-up-delayed-5 {
                    animation: slideUp 0.8s ease-out 1.2s both;
                }

                .animate-slide-up-delayed-6 {
                    animation: slideUp 0.8s ease-out 1.4s both;
                }

                .animate-slide-up-delayed-7 {
                    animation: slideUp 0.8s ease-out 1.6s both;
                }

                .animate-slide-up-delayed-8 {
                    animation: slideUp 0.8s ease-out 1.8s both;
                }

                .animate-slide-up-delayed-9 {
                    animation: slideUp 0.8s ease-out 2s both;
                }

                .animate-slide-up-delayed-10 {
                    animation: slideUp 0.8s ease-out 2.2s both;
                }

                .animate-slide-up-delayed-11 {
                    animation: slideUp 0.8s ease-out 2.4s both;
                }
            `}</style>
        </div>
    );
}
