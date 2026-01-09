#!/usr/bin/env tsx

import { PrismaClient, CompanySize, JobType, UserRole } from "@prisma/client";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { log } from "app/shared/services";

// Note: DATABASE_URL should be set by the calling script (sync-schema-and-seed.ts)
// or in environment variables before running this script directly
if (!process.env.DATABASE_URL) {
    log.error("❌ DATABASE_URL is not set. Please run via sync:dev or sync:prod");
    process.exit(1);
}

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
    codingLanguage: "javascript",
    backgroundQuestionTimeSeconds: 15 * 60,
    codingQuestionTimeSeconds: 7 * 60,
};

const QM_PYTHON_BACKGROUND_QUESTION = "Tell me about a large-scale production system you built or maintained using Python. What were the architectural challenges?";

const QM_PYTHON_INTERVIEW = {
    id: "qm-python-interview",
    backgroundQuestion: QM_PYTHON_BACKGROUND_QUESTION,
    codingPrompt:
        "Build a Python class called `QuantumCircuitSimulator` that simulates a simple quantum circuit with basic gates. Feel free to ask me anything you want.",
    codingTemplate: `"""
Task:
Build a Python class called QuantumCircuitSimulator that:
1. Initializes with a number of qubits (default 2)
2. Supports adding basic gates: Hadamard (H), Pauli-X, CNOT
3. Has a method to measure the circuit state
4. Uses numpy for state vector representation
"""

import numpy as np

class QuantumCircuitSimulator:
    def __init__(self, num_qubits=2):
        # Your code here
        pass
    
    def hadamard(self, qubit):
        # Your code here
        pass
    
    def pauli_x(self, qubit):
        # Your code here
        pass
    
    def measure(self):
        # Your code here
        pass
`,
    codingAnswer: `import numpy as np

class QuantumCircuitSimulator:
    def __init__(self, num_qubits=2):
        self.num_qubits = num_qubits
        self.state = np.zeros(2**num_qubits, dtype=complex)
        self.state[0] = 1.0
    
    def hadamard(self, qubit):
        H = np.array([[1, 1], [1, -1]]) / np.sqrt(2)
        self._apply_single_qubit_gate(H, qubit)
        return self
    
    def pauli_x(self, qubit):
        X = np.array([[0, 1], [1, 0]])
        self._apply_single_qubit_gate(X, qubit)
        return self
    
    def _apply_single_qubit_gate(self, gate, target):
        n = self.num_qubits
        full_gate = np.eye(1)
        for i in range(n):
            full_gate = np.kron(full_gate, gate if i == target else np.eye(2))
        self.state = full_gate @ self.state
    
    def measure(self):
        probs = np.abs(self.state)**2
        return np.random.choice(len(self.state), p=probs)
`,
    expectedOutput: `Quantum simulator with state vector manipulation and measurement`,
    codingLanguage: "python",
    backgroundQuestionTimeSeconds: 15 * 60,
    codingQuestionTimeSeconds: 10 * 60,
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

        log.info("Creating candidate user...");
        const candidateUser = await prisma.user.create({
            data: {
                id: "candidate-noam-hoze",
                name: "Noam Hoze",
                email: "noam.hoze@gmail.com",
                password: hashedPassword,
                role: UserRole.CANDIDATE,
                image: undefined,
            },
        });

        // Create candidate profile
        await prisma.candidateProfile.create({
            data: {
                userId: candidateUser.id,
                jobTitle: "Full Stack Engineer",
                location: "Tel Aviv, Israel",
                bio: "Passionate software engineer with experience in full-stack development",
                skills: ["React", "TypeScript", "Node.js", "Python", "PostgreSQL"],
                experience: "5 years",
                linkedin: undefined,
                github: undefined,
                portfolio: undefined,
                resume: undefined,
            },
        });

        log.info(`   └─ Created candidate account: ${candidateUser.email}`);

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
                codingLanguage: SHARED_FRONTEND_INTERVIEW.codingLanguage,
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
                codingLanguage: SHARED_FRONTEND_INTERVIEW.codingLanguage,
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
                codingCategories: [
                    {
                        name: "TypeScript Proficiency",
                        description: "Type safety, interfaces, generics usage",
                        weight: 33,
                    },
                    {
                        name: "React Best Practices",
                        description: "Component composition, hooks usage, lifecycle management",
                        weight: 33,
                    },
                    {
                        name: "Performance Optimization",
                        description: "Code splitting, lazy loading, rendering optimization",
                        weight: 34,
                    },
                ],
                experienceCategories: [
                    {
                        name: "React Application Architecture at Scale",
                        example: "Has designed and owned large React codebases, defined component and state architecture, managed complexity over time, and made trade-offs for performance and maintainability in production systems.",
                        description: "",
                        weight: 33,
                    },
                    {
                        name: "Advanced State Management and Data Flow in React",
                        example: "Has implemented and evolved complex client-side data flows (global state, async data, caching), integrated with APIs, and debugged real user-impacting issues caused by state or rendering behavior.",
                        description: "",
                        weight: 33,
                    },
                    {
                        name: "Frontend Performance, Reliability, and Production Ownership",
                        example: "Has optimized rendering performance, handled frontend errors and monitoring, collaborated with backend teams on contracts, and shipped fixes for production frontend incidents.",
                        description: "",
                        weight: 34,
                    },
                ],
            },
        });
        if (frontendJobUpdate.count === 0) {
            throw new Error("No Frontend Engineer jobs found to attach interview content");
        }
        log.info(
            `Linked interview content to ${frontendJobUpdate.count} Frontend Engineer jobs (including Meta)`
        );

        log.info("Seeding QM Python interview content for Senior Python Engineer role...");
        const qmInterviewContent = await prisma.interviewContent.upsert({
            where: {
                id: QM_PYTHON_INTERVIEW.id,
            },
            update: {
                backgroundQuestion: QM_PYTHON_INTERVIEW.backgroundQuestion,
                codingPrompt: QM_PYTHON_INTERVIEW.codingPrompt,
                codingTemplate: QM_PYTHON_INTERVIEW.codingTemplate,
                codingAnswer: QM_PYTHON_INTERVIEW.codingAnswer,
                expectedOutput: QM_PYTHON_INTERVIEW.expectedOutput,
                codingLanguage: QM_PYTHON_INTERVIEW.codingLanguage,
                backgroundQuestionTimeSeconds: QM_PYTHON_INTERVIEW.backgroundQuestionTimeSeconds,
                codingQuestionTimeSeconds: QM_PYTHON_INTERVIEW.codingQuestionTimeSeconds,
            },
            create: {
                id: QM_PYTHON_INTERVIEW.id,
                backgroundQuestion: QM_PYTHON_INTERVIEW.backgroundQuestion,
                codingPrompt: QM_PYTHON_INTERVIEW.codingPrompt,
                codingTemplate: QM_PYTHON_INTERVIEW.codingTemplate,
                codingAnswer: QM_PYTHON_INTERVIEW.codingAnswer,
                expectedOutput: QM_PYTHON_INTERVIEW.expectedOutput,
                codingLanguage: QM_PYTHON_INTERVIEW.codingLanguage,
                backgroundQuestionTimeSeconds: QM_PYTHON_INTERVIEW.backgroundQuestionTimeSeconds,
                codingQuestionTimeSeconds: QM_PYTHON_INTERVIEW.codingQuestionTimeSeconds,
            },
        });
        const pythonJobUpdate = await prisma.job.updateMany({
            where: {
                title: "Senior Python Engineer",
            },
            data: {
                interviewContentId: qmInterviewContent.id,
                codingCategories: [
                    {
                        name: "Python Proficiency (5+ years hands-on)",
                        description: "Deep Python expertise, idiomatic code, advanced features",
                        weight: 40,
                    },
                    {
                        name: "Code Quality and Explainability",
                        description: "Clear decision-making, maintainable code, documentation",
                        weight: 40,
                    },
                    {
                        name: "Software Development Experience (7+ years)",
                        description: "Professional development experience, architectural knowledge",
                        weight: 20,
                    },
                ],
                experienceCategories: [
                    {
                        name: "Production Systems and Code Quality",
                        example: "Has written and maintained production code for large systems, handled code review, testing, and system integration in professional environments.",
                        description: "7+ years SW development, production code, code review/testing",
                        weight: 32,
                    },
                    {
                        name: "Software Architecture and Design Patterns",
                        example: "Has deep understanding of design patterns, systems architecture, and software engineering principles. Holds relevant CS degree or equivalent.",
                        description: "Design patterns, system architecture, CS degree",
                        weight: 18,
                    },
                    {
                        name: "Open Source and SDK Development",
                        example: "Has contributed to open source projects and developed SDKs or libraries used by other developers. Experience with quantum computing SDK development is a strong advantage.",
                        description: "Open source contributions, SDK development, quantum computing",
                        weight: 20,
                    },
                    {
                        name: "Quantum Computing Domain Knowledge",
                        example: "Has experience in the field of quantum computing, quantum algorithms, or related computational physics domains.",
                        description: "Quantum computing experience",
                        weight: 10,
                    },
                    {
                        name: "Leadership and Technical Ownership",
                        example: "Has led technical initiatives, mentored engineers, and taken ownership of critical systems and architectural decisions.",
                        description: "Technical leadership, mentorship, system ownership",
                        weight: 20,
                    },
                ],
            },
        });
        if (pythonJobUpdate.count === 0) {
            throw new Error("No Senior Python Engineer jobs found to attach interview content");
        }
        log.info(
            `Linked interview content to ${pythonJobUpdate.count} Senior Python Engineer jobs (QM)`
        );

        log.info("Database reset and seeded successfully!");

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
