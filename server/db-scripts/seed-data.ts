#!/usr/bin/env tsx

import { PrismaClient, CompanySize, JobType, UserRole } from "@prisma/client";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { log } from "app/shared/services";

// Import seed functions
import { seedGal } from "./seed-candidate/seed-gal";
import { seedGalSession2 } from "./seed-candidate/seed-gal-session2";
import { seedGalSession3 } from "./seed-candidate/seed-gal-session3";
import { seedGalSession4 } from "./seed-candidate/seed-gal-session4";
import { seedGalSession5 } from "./seed-candidate/seed-gal-session5";
import { seedMark } from "./seed-candidate/seed-mark";

const prisma = new PrismaClient();

const FRONTEND_BACKGROUND_QUESTION =
    "Tell me about a complex React integration you built. What made it challenging?";

const DEFAULT_FRONTEND_INTERVIEW = {
    id: "shared-frontend-interview",
    backgroundQuestion: FRONTEND_BACKGROUND_QUESTION,
    codingPrompt:
        "Create a React component where a simulated child frame sends analytics events to the parent app using postMessage. The parent Listens for these events, Validates that they follow a given schema and displays them in a list. Let's start!",
    codingTemplate: `// App.tsx
// Task:
// 1. Listen for "analytics:event" messages sent via window.postMessage.
// 2. Only accept messages with { type: "analytics:event", name: string, ts: number }.
// 3. Display each valid event name in a list.
// 4. Clean up listeners on unmount.
// 5. (Bonus) Simulate sending an event when clicking a button.

import React, { useEffect, useState } from "react";

export default function App() {
  const [events, setEvents] = useState<string[]>([]);

  // your code here

  return (
    <div style={{ padding: 20 }}>
      <h2>Analytics Event Receiver</h2>
      {/* add button and list here */}
    </div>
  );
}
`,
    codingAnswer: `import React, { useEffect, useState } from "react";

export default function App() {
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type !== "analytics:event") return;
      if (typeof e.data.name !== "string" || typeof e.data.ts !== "number") return;
      setEvents(prev => [...prev, e.data.name]);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const sendMockEvent = () => {
    const event = { type: "analytics:event", name: "ButtonClicked", ts: Date.now() };
    window.postMessage(event, "*");
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>Analytics Event Receiver</h2>
      <button onClick={sendMockEvent}>Simulate Event</button>
      <ul style={{ marginTop: 20 }}>
        {events.map((name, i) => (<li key={i}>{name}</li>))}
      </ul>
    </div>
  );
}
`,
};

const META_FRONTEND_INTERVIEW = {
    id: "meta-frontend-interview",
    backgroundQuestion: FRONTEND_BACKGROUND_QUESTION,
    codingPrompt:
        "Please build a React component called `UserList` that fetches users from the provided API and displays their name and email in a styled list. Feel free to ask me anything you want.",
    codingTemplate: `/*
  Task:
  Build a React component called \`UserList\` that:
  1. Fetches users from the API: https://jsonplaceholder.typicode.com/users
  2. Displays each user's name and email in a list.
  3. Shows a "Loading..." message while fetching.
  4. Shows an error message if the request fails.
*/

import React, { useState, useEffect } from "react";

function UserList() {
  // Your code here

  return (
    <ul>
      {/* Render user name and email here */}
    </ul>
  );
}

export default UserList;
`,
    codingAnswer: `import React, { useState, useEffect } from "react";

function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("https://jsonplaceholder.typicode.com/users")
      .then(r => r.json())
      .then(d => {
        setUsers(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <ul>
      {users.map(u => (
        <li key={u.id}>
          <strong>{u.name}</strong> - {u.email}
        </li>
      ))}
    </ul>
  );
}

export default UserList;
`,
};

// Map mock data size to Prisma enum
const mapCompanySize = (size: string): CompanySize => {
    switch (size.toLowerCase()) {
        case "startup":
            return CompanySize.STARTUP;
        case "small":
            return CompanySize.SMALL;
        case "medium":
            return CompanySize.MEDIUM;
        case "large":
            return CompanySize.LARGE;
        case "enterprise":
            return CompanySize.ENTERPRISE;
        default:
            return CompanySize.MEDIUM;
    }
};

// Map mock data job type to Prisma enum
const mapJobType = (type: string): JobType => {
    switch (type.toLowerCase()) {
        case "full-time":
            return JobType.FULL_TIME;
        case "part-time":
            return JobType.PART_TIME;
        case "contract":
            return JobType.CONTRACT;
        default:
            return JobType.FULL_TIME;
    }
};

async function resetDatabase() {
    try {
        const companiesPath = path.join(
            process.cwd(),
            "server/db-scripts/data/companies.json"
        );
        const companiesData = JSON.parse(
            fs.readFileSync(companiesPath, "utf-8")
        );
        log.info("Clearing existing data...");

        // Delete in reverse order of dependencies
        await prisma.job.deleteMany();
        await prisma.interviewContent.deleteMany();
        await prisma.company.deleteMany();
        await prisma.companyProfile.deleteMany();
        await prisma.candidateProfile.deleteMany();
        await prisma.user.deleteMany();

        log.info("Seeding companies, users, and jobs...");

        // Hash the password once for all users
        const hashedPassword = await bcrypt.hash("sfinx", 12);

        for (const companyData of companiesData) {
            const company = await prisma.company.create({
                data: {
                    id: companyData.id,
                    name: companyData.name,
                    logo: companyData.logo,
                    industry: companyData.industry,
                    locations: companyData.locations,
                    cultureTags: companyData.cultureTags,
                    size: mapCompanySize(companyData.size),
                },
            });

            log.info(`Created company: ${company.name}`);

            // Create user account for company manager
            const managerEmail = `manager@${companyData.name
                .toLowerCase()
                .replace(/\s+/g, "")}.com`;
            const user = await prisma.user.create({
                data: {
                    id: `manager-${companyData.id}`,
                    name: `${companyData.name} Manager`,
                    email: managerEmail,
                    password: hashedPassword,
                    role: UserRole.COMPANY,
                    image:
                        companyData.id === "meta"
                            ? "/uploads/profiles/meta-profile.png"
                            : undefined,
                },
            });

            // Create company profile
            await prisma.companyProfile.create({
                data: {
                    userId: user.id,
                    companyName: companyData.name,
                    companySize: mapCompanySize(companyData.size),
                    location: companyData.locations[0], // Use first location
                    bio: `Leading company in ${companyData.industry}`,
                    website: `https://www.${companyData.name
                        .toLowerCase()
                        .replace(/\s+/g, "")}.com`,
                    industry: companyData.industry,
                    description: `${companyData.name} is a ${
                        companyData.size
                    } company focused on ${
                        companyData.industry
                    }. Our culture emphasizes ${companyData.cultureTags.join(
                        ", "
                    )}.`,
                    benefits: companyData.cultureTags,
                },
            });

            log.info(`   └─ Created manager account: ${managerEmail}`);

            // Create jobs for this company
            for (const jobData of companyData.openRoles) {
                await prisma.job.create({
                    data: {
                        id: `${companyData.id}-${jobData.title
                            .toLowerCase()
                            .replace(/\s+/g, "-")}`,
                        title: jobData.title,
                        type: mapJobType(jobData.type),
                        location: jobData.location,
                        salary: jobData.salary,
                        companyId: company.id,
                    },
                });
            }

            log.info(`   └─ Created ${companyData.openRoles.length} jobs for ${company.name}`);
        }

        log.info("Seeding shared interview content for frontend roles...");
          const [defaultInterview, metaInterview] = await Promise.all([
              prisma.interviewContent.upsert({
                  where: { id: DEFAULT_FRONTEND_INTERVIEW.id },
                  update: {
                      backgroundQuestion: DEFAULT_FRONTEND_INTERVIEW.backgroundQuestion,
                      codingPrompt: DEFAULT_FRONTEND_INTERVIEW.codingPrompt,
                      codingTemplate: DEFAULT_FRONTEND_INTERVIEW.codingTemplate,
                      codingAnswer: DEFAULT_FRONTEND_INTERVIEW.codingAnswer,
                  },
                  create: {
                      id: DEFAULT_FRONTEND_INTERVIEW.id,
                      backgroundQuestion: DEFAULT_FRONTEND_INTERVIEW.backgroundQuestion,
                      codingPrompt: DEFAULT_FRONTEND_INTERVIEW.codingPrompt,
                      codingTemplate: DEFAULT_FRONTEND_INTERVIEW.codingTemplate,
                      codingAnswer: DEFAULT_FRONTEND_INTERVIEW.codingAnswer,
                  },
              }),
              prisma.interviewContent.upsert({
                  where: { id: META_FRONTEND_INTERVIEW.id },
                  update: {
                      backgroundQuestion: META_FRONTEND_INTERVIEW.backgroundQuestion,
                      codingPrompt: META_FRONTEND_INTERVIEW.codingPrompt,
                      codingTemplate: META_FRONTEND_INTERVIEW.codingTemplate,
                      codingAnswer: META_FRONTEND_INTERVIEW.codingAnswer,
                  },
                  create: {
                      id: META_FRONTEND_INTERVIEW.id,
                      backgroundQuestion: META_FRONTEND_INTERVIEW.backgroundQuestion,
                      codingPrompt: META_FRONTEND_INTERVIEW.codingPrompt,
                      codingTemplate: META_FRONTEND_INTERVIEW.codingTemplate,
                      codingAnswer: META_FRONTEND_INTERVIEW.codingAnswer,
                  },
              }),
          ]);

          const nonMetaFrontendUpdate = await prisma.job.updateMany({
              where: {
                  title: "Frontend Engineer",
                  companyId: { not: "meta" },
              },
              data: {
                  interviewContentId: defaultInterview.id,
              },
          });

          await prisma.job.update({
              where: { id: "meta-frontend-engineer" },
              data: {
                  interviewContentId: metaInterview.id,
              },
          });
          log.info(
              `Linked interview content to ${nonMetaFrontendUpdate.count} non-Meta Frontend Engineer jobs`
          );
          log.info("Linked interview content to Meta Frontend Engineer job");

        log.info("Database reset and seeded successfully!");

        // Create additional candidates using existing seed scripts
        await seedGal();
        await seedGalSession2();
        await seedGalSession3();
        await seedGalSession4();
        await seedGalSession5();
        await seedMark();

        // Print summary
        const companyCount = await prisma.company.count();
        const jobCount = await prisma.job.count();
        const userCount = await prisma.user.count();
        log.info(`Summary: ${companyCount} companies, ${userCount} users, ${jobCount} jobs`);
    } catch (error) {
        log.error("❌ Error resetting database:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

resetDatabase();
