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
import { seedDemoCandidate } from "./seed-candidate/seed-demo-candidate";

const prisma = new PrismaClient();

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

const FRONTEND_BACKGROUND_QUESTION = "Tell me about a complex React integration you built. What made it challenging?";

const SHARED_FRONTEND_INTERVIEW = {
    id: "shared-frontend-interview",
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

function UserList() {
  // Your code here

  return (
    <ul>
      {/* Render user name and email here */}
    </ul>
  );
}

render(<UserList />);
`,
    codingAnswer: `function UserList() {
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

render(<UserList />);
`,
    expectedOutput: `Leanne Graham - Sincere@april.biz
Ervin Howell - Shanna@melissa.tv
Clementine Bauch - Nathan@yesenia.net
Patricia Lebsack - Julianne.OConner@kory.org
Chelsey Dietrich - Lucio_Hettinger@annie.ca
Mrs. Dennis Schulist - Karley_Dach@jasper.info
Kurtis Weissnat - Telly.Hoeger@billy.biz
Nicholas Runolfsdottir V - Sherwood@rosamond.me
Glenna Reichert - Chaim_McDermott@dana.io
Clementina DuBuque - Rey.Padberg@karina.biz`,
    backgroundQuestionTimeSeconds: 15 * 60,
    codingQuestionTimeSeconds: 7 * 60,
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

        log.info("Seeding shared interview content for all Frontend Engineer roles...");
        const interviewContent = await prisma.interviewContent.upsert({
            where: {
                id: SHARED_FRONTEND_INTERVIEW.id,
            },
            update: {
                backgroundQuestion: SHARED_FRONTEND_INTERVIEW.backgroundQuestion,
                codingPrompt: SHARED_FRONTEND_INTERVIEW.codingPrompt,
                codingTemplate: SHARED_FRONTEND_INTERVIEW.codingTemplate,
                codingAnswer: SHARED_FRONTEND_INTERVIEW.codingAnswer,
                expectedOutput: SHARED_FRONTEND_INTERVIEW.expectedOutput,
                backgroundQuestionTimeSeconds: SHARED_FRONTEND_INTERVIEW.backgroundQuestionTimeSeconds,
                codingQuestionTimeSeconds: SHARED_FRONTEND_INTERVIEW.codingQuestionTimeSeconds,
            },
            create: {
                id: SHARED_FRONTEND_INTERVIEW.id,
                backgroundQuestion: SHARED_FRONTEND_INTERVIEW.backgroundQuestion,
                codingPrompt: SHARED_FRONTEND_INTERVIEW.codingPrompt,
                codingTemplate: SHARED_FRONTEND_INTERVIEW.codingTemplate,
                codingAnswer: SHARED_FRONTEND_INTERVIEW.codingAnswer,
                expectedOutput: SHARED_FRONTEND_INTERVIEW.expectedOutput,
                backgroundQuestionTimeSeconds: SHARED_FRONTEND_INTERVIEW.backgroundQuestionTimeSeconds,
                codingQuestionTimeSeconds: SHARED_FRONTEND_INTERVIEW.codingQuestionTimeSeconds,
            },
        });
        const frontendJobUpdate = await prisma.job.updateMany({
            where: {
                title: "Frontend Engineer",
            },
            data: {
                interviewContentId: interviewContent.id,
            },
        });
        if (frontendJobUpdate.count === 0) {
            throw new Error("No Frontend Engineer jobs found to attach interview content");
        }
        log.info(
            `Linked interview content to ${frontendJobUpdate.count} Frontend Engineer jobs (including Meta)`
        );

        log.info("Database reset and seeded successfully!");

        // Create additional candidates using existing seed scripts
        await seedGal();
        await seedGalSession2();
        await seedGalSession3();
        await seedGalSession4();
        await seedGalSession5();
        await seedMark();
        await seedDemoCandidate();

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
