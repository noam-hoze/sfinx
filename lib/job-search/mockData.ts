export interface Company {
    id: string;
    name: string;
    logo: string;
    industry: string;
    locations: string[];
    openRoles: {
        title: string;
        type: "full-time" | "part-time" | "contract";
        location: string;
        salary?: string;
    }[];
    cultureTags: string[];
    size: "startup" | "small" | "medium" | "large" | "enterprise";
}

export const companiesData: Company[] = [
    {
        id: "google",
        name: "Google",
        logo: "/company-logos/google-logo.png",
        industry: "Technology",
        locations: [
            "Mountain View, CA",
            "New York, NY",
            "London, UK",
            "Remote",
        ],
        size: "enterprise",
        cultureTags: [
            "Innovation",
            "Work-Life Balance",
            "Diversity",
            "Sustainability",
        ],
        openRoles: [
            {
                title: "Software Engineer",
                type: "full-time",
                location: "Mountain View, CA",
                salary: "$150k - $220k",
            },
            {
                title: "Product Manager",
                type: "full-time",
                location: "New York, NY",
                salary: "$180k - $250k",
            },
            {
                title: "Data Scientist",
                type: "full-time",
                location: "Remote",
                salary: "$140k - $200k",
            },
        ],
    },
    {
        id: "meta",
        name: "Meta",
        logo: "/company-logos/meta-logo.png",
        industry: "Social Media",
        locations: ["Menlo Park, CA", "Seattle, WA", "New York, NY", "Remote"],
        size: "large",
        cultureTags: [
            "Innovation",
            "Global Impact",
            "Fast-paced",
            "Tech-forward",
        ],
        openRoles: [
            {
                title: "Frontend Engineer",
                type: "full-time",
                location: "Menlo Park, CA",
                salary: "$160k - $230k",
            },
            {
                title: "Machine Learning Engineer",
                type: "full-time",
                location: "Seattle, WA",
                salary: "$170k - $240k",
            },
            {
                title: "UI/UX Designer",
                type: "full-time",
                location: "New York, NY",
                salary: "$130k - $180k",
            },
        ],
    },
    {
        id: "netflix",
        name: "Netflix",
        logo: "/company-logos/netflix-logo.png",
        industry: "Entertainment",
        locations: ["Los Angeles, CA", "San Francisco, CA", "Remote"],
        size: "large",
        cultureTags: ["Creativity", "Innovation", "Freedom", "Quality"],
        openRoles: [
            {
                title: "Senior Software Engineer",
                type: "full-time",
                location: "Los Angeles, CA",
                salary: "$200k - $280k",
            },
            {
                title: "Data Engineer",
                type: "full-time",
                location: "San Francisco, CA",
                salary: "$180k - $250k",
            },
            {
                title: "Product Designer",
                type: "full-time",
                location: "Remote",
                salary: "$150k - $210k",
            },
        ],
    },
    {
        id: "airbnb",
        name: "Airbnb",
        logo: "/company-logos/airbnb-logo.png",
        industry: "Hospitality",
        locations: [
            "San Francisco, CA",
            "New York, NY",
            "London, UK",
            "Remote",
        ],
        size: "large",
        cultureTags: ["Belonging", "Community", "Innovation", "Trust"],
        openRoles: [
            {
                title: "Full Stack Engineer",
                type: "full-time",
                location: "San Francisco, CA",
                salary: "$170k - $240k",
            },
            {
                title: "Data Analyst",
                type: "full-time",
                location: "New York, NY",
                salary: "$120k - $160k",
            },
            {
                title: "Product Manager",
                type: "full-time",
                location: "London, UK",
                salary: "$150k - $200k",
            },
        ],
    },
    {
        id: "stripe",
        name: "Stripe",
        logo: "/company-logos/stripe-logo.png",
        industry: "Fintech",
        locations: [
            "San Francisco, CA",
            "New York, NY",
            "Dublin, IE",
            "Remote",
        ],
        size: "medium",
        cultureTags: [
            "Innovation",
            "Simplicity",
            "Global",
            "Engineering-first",
        ],
        openRoles: [
            {
                title: "Software Engineer",
                type: "full-time",
                location: "San Francisco, CA",
                salary: "$180k - $250k",
            },
            {
                title: "Security Engineer",
                type: "full-time",
                location: "New York, NY",
                salary: "$170k - $230k",
            },
            {
                title: "DevOps Engineer",
                type: "full-time",
                location: "Remote",
                salary: "$160k - $220k",
            },
        ],
    },
    {
        id: "spotify",
        name: "Spotify",
        logo: "/company-logos/spotify-logo.png",
        industry: "Music Streaming",
        locations: [
            "Stockholm, SE",
            "New York, NY",
            "Los Angeles, CA",
            "Remote",
        ],
        size: "large",
        cultureTags: ["Creativity", "Music", "Innovation", "Global"],
        openRoles: [
            {
                title: "Backend Engineer",
                type: "full-time",
                location: "Stockholm, SE",
                salary: "$150k - $210k",
            },
            {
                title: "Machine Learning Engineer",
                type: "full-time",
                location: "New York, NY",
                salary: "$170k - $230k",
            },
            {
                title: "Product Designer",
                type: "full-time",
                location: "Los Angeles, CA",
                salary: "$130k - $180k",
            },
        ],
    },
    {
        id: "slack",
        name: "Slack",
        logo: "/company-logos/slack-logo.png",
        industry: "Communication",
        locations: [
            "San Francisco, CA",
            "New York, NY",
            "Toronto, CA",
            "Remote",
        ],
        size: "medium",
        cultureTags: [
            "Collaboration",
            "Transparency",
            "Innovation",
            "Remote-first",
        ],
        openRoles: [
            {
                title: "Frontend Engineer",
                type: "full-time",
                location: "San Francisco, CA",
                salary: "$160k - $220k",
            },
            {
                title: "Product Manager",
                type: "full-time",
                location: "New York, NY",
                salary: "$170k - $230k",
            },
            {
                title: "UX Researcher",
                type: "full-time",
                location: "Remote",
                salary: "$130k - $180k",
            },
        ],
    },
    {
        id: "uber",
        name: "Uber",
        logo: "/company-logos/uber-logo.png",
        industry: "Transportation",
        locations: [
            "San Francisco, CA",
            "New York, NY",
            "Chicago, IL",
            "Remote",
        ],
        size: "large",
        cultureTags: ["Innovation", "Global", "Impact", "Growth"],
        openRoles: [
            {
                title: "Software Engineer",
                type: "full-time",
                location: "San Francisco, CA",
                salary: "$170k - $240k",
            },
            {
                title: "Data Scientist",
                type: "full-time",
                location: "New York, NY",
                salary: "$160k - $220k",
            },
            {
                title: "Operations Manager",
                type: "full-time",
                location: "Chicago, IL",
                salary: "$120k - $160k",
            },
        ],
    },
    {
        id: "dropbox",
        name: "Dropbox",
        logo: "/company-logos/dropbox-logo.png",
        industry: "Cloud Storage",
        locations: [
            "San Francisco, CA",
            "New York, NY",
            "Seattle, WA",
            "Remote",
        ],
        size: "medium",
        cultureTags: [
            "Collaboration",
            "Simplicity",
            "Innovation",
            "Remote-first",
        ],
        openRoles: [
            {
                title: "Full Stack Engineer",
                type: "full-time",
                location: "San Francisco, CA",
                salary: "$165k - $225k",
            },
            {
                title: "Security Engineer",
                type: "full-time",
                location: "New York, NY",
                salary: "$155k - $210k",
            },
            {
                title: "Product Designer",
                type: "full-time",
                location: "Remote",
                salary: "$140k - $190k",
            },
        ],
    },
    {
        id: "twitter",
        name: "Twitter",
        logo: "/company-logos/twitter-logo.png",
        industry: "Social Media",
        locations: [
            "San Francisco, CA",
            "New York, NY",
            "Austin, TX",
            "Remote",
        ],
        size: "large",
        cultureTags: ["Free Speech", "Innovation", "Transparency", "Impact"],
        openRoles: [
            {
                title: "Software Engineer",
                type: "full-time",
                location: "San Francisco, CA",
                salary: "$170k - $240k",
            },
            {
                title: "Machine Learning Engineer",
                type: "full-time",
                location: "New York, NY",
                salary: "$175k - $245k",
            },
            {
                title: "Data Engineer",
                type: "full-time",
                location: "Austin, TX",
                salary: "$150k - $210k",
            },
        ],
    },
    {
        id: "notion",
        name: "Notion",
        logo: "/company-logos/notion-logo.png",
        industry: "Productivity",
        locations: ["San Francisco, CA", "New York, NY", "Tokyo, JP", "Remote"],
        size: "medium",
        cultureTags: [
            "Creativity",
            "Collaboration",
            "Innovation",
            "User-focused",
        ],
        openRoles: [
            {
                title: "Frontend Engineer",
                type: "full-time",
                location: "San Francisco, CA",
                salary: "$160k - $220k",
            },
            {
                title: "Product Designer",
                type: "full-time",
                location: "New York, NY",
                salary: "$140k - $190k",
            },
            {
                title: "Technical Writer",
                type: "contract",
                location: "Remote",
                salary: "$80k - $120k",
            },
        ],
    },
    {
        id: "zoom",
        name: "Zoom",
        logo: "/company-logos/zoom-logo.png",
        industry: "Video Communication",
        locations: ["San Jose, CA", "New York, NY", "Austin, TX", "Remote"],
        size: "large",
        cultureTags: ["Innovation", "Global", "Connectivity", "Growth"],
        openRoles: [
            {
                title: "Software Engineer",
                type: "full-time",
                location: "San Jose, CA",
                salary: "$165k - $225k",
            },
            {
                title: "Security Engineer",
                type: "full-time",
                location: "New York, NY",
                salary: "$155k - $210k",
            },
            {
                title: "DevOps Engineer",
                type: "full-time",
                location: "Austin, TX",
                salary: "$150k - $200k",
            },
        ],
    },
    {
        id: "figma",
        name: "Figma",
        logo: "/company-logos/figma-logo.png",
        industry: "Design Tools",
        locations: [
            "San Francisco, CA",
            "New York, NY",
            "Berlin, DE",
            "Remote",
        ],
        size: "medium",
        cultureTags: ["Design", "Innovation", "Collaboration", "User-focused"],
        openRoles: [
            {
                title: "Frontend Engineer",
                type: "full-time",
                location: "San Francisco, CA",
                salary: "$170k - $230k",
            },
            {
                title: "Product Designer",
                type: "full-time",
                location: "New York, NY",
                salary: "$150k - $200k",
            },
            {
                title: "Engineering Manager",
                type: "full-time",
                location: "Remote",
                salary: "$200k - $260k",
            },
        ],
    },
    {
        id: "github",
        name: "GitHub",
        logo: "/company-logos/github-logo.png",
        industry: "Developer Tools",
        locations: ["San Francisco, CA", "New York, NY", "Remote"],
        size: "medium",
        cultureTags: [
            "Open Source",
            "Collaboration",
            "Innovation",
            "Community",
        ],
        openRoles: [
            {
                title: "Software Engineer",
                type: "full-time",
                location: "San Francisco, CA",
                salary: "$175k - $240k",
            },
            {
                title: "Site Reliability Engineer",
                type: "full-time",
                location: "New York, NY",
                salary: "$165k - $220k",
            },
            {
                title: "Product Manager",
                type: "full-time",
                location: "Remote",
                salary: "$180k - $240k",
            },
        ],
    },
];
