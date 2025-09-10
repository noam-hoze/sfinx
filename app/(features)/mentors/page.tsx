"use client";

import Image from "next/image";
import { AuthGuard } from "app/shared/components";

// Mock mentor data - hardcoded for demo
const mockMentors = [
    {
        id: "1",
        name: "Benny Cohen",
        title: "Senior Software Engineer at Google",
        avatar: "https://i.pravatar.cc/150?u=sarahchen",
        hourlyRate: 85,
        expertise: ["React", "TypeScript", "System Design", "Code Reviews"],
        bio: "10+ years building scalable web applications. Specialize in React/TypeScript and helping engineers level up their architecture skills.",
        rating: 4.9,
        reviewCount: 47,
        availability: "Available now",
    },
    {
        id: "2",
        name: "Mark Johnson",
        title: "Principal Engineer at Meta",
        avatar: "https://i.pravatar.cc/150?u=markjohnson",
        hourlyRate: 120,
        expertise: [
            "Python",
            "Machine Learning",
            "Data Structures",
            "Interview Prep",
        ],
        bio: "Former FAANG interviewer with 15+ years experience. Help candidates master algorithms and system design for top tech roles.",
        rating: 5.0,
        reviewCount: 89,
        availability: "Available in 2 hours",
    },
    {
        id: "3",
        name: "Elena Rodriguez",
        title: "Tech Lead at Netflix",
        avatar: "https://i.pravatar.cc/150?u=elenarodriguez",
        hourlyRate: 95,
        expertise: ["Java", "Microservices", "Leadership", "Career Growth"],
        bio: "Engineering leader passionate about mentorship. Help engineers navigate career progression and technical leadership roles.",
        rating: 4.8,
        reviewCount: 63,
        availability: "Available tomorrow",
    },
    {
        id: "4",
        name: "David Kim",
        title: "Staff Engineer at Stripe",
        avatar: "https://i.pravatar.cc/150?u=davidkim",
        hourlyRate: 110,
        expertise: ["Go", "Distributed Systems", "Performance", "Scaling"],
        bio: "Backend specialist with deep expertise in distributed systems. Guide engineers through complex architecture challenges.",
        rating: 4.9,
        reviewCount: 72,
        availability: "Available now",
    },
    {
        id: "5",
        name: "Lisa Thompson",
        title: "Senior Frontend Engineer at Airbnb",
        avatar: "https://i.pravatar.cc/150?u=lisathompson",
        hourlyRate: 80,
        expertise: ["JavaScript", "CSS", "UI/UX", "Design Systems"],
        bio: "Frontend expert focused on creating exceptional user experiences. Help developers master modern frontend technologies.",
        rating: 4.7,
        reviewCount: 54,
        availability: "Available in 1 hour",
    },
    {
        id: "6",
        name: "Rita Patel",
        title: "Engineering Manager at Slack",
        avatar: "https://i.pravatar.cc/150?u=alexpatel",
        hourlyRate: 100,
        expertise: ["Management", "Team Leadership", "Communication", "Growth"],
        bio: "People-first engineering leader. Guide aspiring managers through leadership challenges and team dynamics.",
        rating: 4.9,
        reviewCount: 41,
        availability: "Available this week",
    },
];

export default function MentorsPage() {
    return (
        <AuthGuard requiredRole="CANDIDATE">
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-4xl mx-auto px-4 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            Find a Mentor
                        </h1>
                        <p className="text-gray-600">
                            Discover qualified mentors to accelerate your career
                            growth
                        </p>
                    </div>

                    {/* Filters */}
                    <div className="mb-6 flex flex-wrap gap-3">
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                            All Mentors
                        </button>
                        <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                            Frontend
                        </button>
                        <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                            Backend
                        </button>
                        <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                            Leadership
                        </button>
                    </div>

                    {/* Mentor Feed */}
                    <div className="space-y-6">
                        {mockMentors.map((mentor) => (
                            <MentorCard key={mentor.id} mentor={mentor} />
                        ))}
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}

// Mentor Card Component
function MentorCard({ mentor }: { mentor: (typeof mockMentors)[0] }) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                    {/* Avatar */}
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                        <Image
                            src={mentor.avatar}
                            alt={mentor.name}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover rounded-full"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                    parent.innerHTML = `<span class="text-2xl font-bold text-gray-600">${mentor.name.charAt(
                                        0
                                    )}</span>`;
                                }
                            }}
                        />
                    </div>

                    {/* Mentor Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-semibold text-gray-900">
                            {mentor.name}
                        </h3>
                        <p className="text-gray-600 text-sm mb-2">
                            {mentor.title}
                        </p>

                        {/* Rating */}
                        <div className="flex items-center mb-3">
                            <div className="flex items-center">
                                {[...Array(5)].map((_, i) => (
                                    <svg
                                        key={i}
                                        className={`w-4 h-4 ${
                                            i < Math.floor(mentor.rating)
                                                ? "text-yellow-400 fill-current"
                                                : "text-gray-300"
                                        }`}
                                        viewBox="0 0 24 24"
                                    >
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                ))}
                            </div>
                            <span className="text-sm text-gray-600 ml-2">
                                {mentor.rating} ({mentor.reviewCount} reviews)
                            </span>
                        </div>

                        {/* Bio */}
                        <p className="text-gray-700 text-sm mb-4">
                            {mentor.bio}
                        </p>

                        {/* Expertise Tags */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            {mentor.expertise.map((skill, index) => (
                                <span
                                    key={index}
                                    className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
                                >
                                    {skill}
                                </span>
                            ))}
                        </div>

                        {/* Availability */}
                        <div className="flex items-center text-sm text-green-600 mb-4">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                            {mentor.availability}
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <div className="flex flex-col items-end space-y-3">
                    <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                            ${mentor.hourlyRate}
                        </div>
                        <div className="text-sm text-gray-500">per hour</div>
                    </div>
                    <button className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                        Book Session
                    </button>
                </div>
            </div>
        </div>
    );
}
