// In-memory store for mock session data (resets on refresh except localStorage auth)
let mockUsers = [
  {
    id: "u-student-1",
    email: "student@campus.edu",
    password: "password123",
    role: "student",
    name: "Alex Chen",
    branch: "Computer Science",
    year: "3rd Year",
    gpa: "3.4",
  },
  {
    id: "u-mentor-1",
    email: "mentor@campus.edu",
    password: "password123",
    role: "mentor",
    name: "Dr. Priya Patel",
    branch: "Engineering",
    cohort: "CS & IT — Batch 2026",
  },
];

export const getMockUsers = () => mockUsers;

export const addMockUser = (user) => {
  mockUsers = [...mockUsers, user];
};

export const MOCK_STUDENT_SUMMARY = {
  resumeScore: 74,
  placementReadiness: 0.68,
  academicRisk: 0.38,
  schedulePreview: [
    {
      id: "sp-1",
      title: "Data Structures revision",
      day: "Today",
      time: "4:00 PM",
      reason: "weak subject",
    },
    {
      id: "sp-2",
      title: "DBMS assignment draft",
      day: "Tomorrow",
      time: "10:00 AM",
      reason: "deadline in 2 days",
    },
    {
      id: "sp-3",
      title: "Mock interview prep",
      day: "Friday",
      time: "2:00 PM",
      reason: "placement readiness",
    },
  ],
  recentChat: {
    id: "rc-1",
    question: "Explain normalization in DBMS",
    preview: "Normalization reduces redundancy by organizing data into related tables…",
    docTitle: "DBMS Unit 3 Notes",
  },
};

export const MOCK_RESUME_RESULT = {
  score: 74,
  missing_keywords: [
    "Kubernetes",
    "CI/CD",
    "Agile",
    "REST API",
    "Unit testing",
  ],
  suggestions: [
    "Add a bullet quantifying team project impact (e.g. users served, latency reduced).",
    "Include CI/CD or deployment tools if you've used GitHub Actions or similar.",
    "Mention Agile/Scrum if you've worked in sprints during internships.",
    "Expand the projects section with tech stack keywords from the job description.",
  ],
};

export const MOCK_RESUME_HISTORY = [
  {
    id: "rh-1",
    score: 74,
    jobTitle: "Software Engineer Intern",
    createdAt: "2026-07-10",
  },
  {
    id: "rh-2",
    score: 61,
    jobTitle: "Backend Developer",
    createdAt: "2026-06-28",
  },
];

export const MOCK_DOCUMENTS = [
  {
    id: "doc-1",
    title: "DBMS Unit 3 — Normalization",
    subject: "Database Management",
    pages: 24,
  },
  {
    id: "doc-2",
    title: "Operating Systems — Scheduling",
    subject: "Operating Systems",
    pages: 18,
  },
  {
    id: "doc-3",
    title: "Data Structures — Trees & Graphs",
    subject: "Data Structures",
    pages: 32,
  },
  {
    id: "doc-4",
    title: "Placement Prep — Aptitude Basics",
    subject: "Career",
    pages: 12,
  },
];

export const MOCK_SUGGESTED_QUESTIONS = [
  "What is third normal form?",
  "Compare FCFS and Round Robin scheduling",
  "Explain BFS vs DFS with examples",
  "How do I prepare for aptitude tests?",
];

export const MOCK_CHAT_RESPONSES = {
  default: {
    answer:
      "Based on your uploaded materials, here's a concise explanation tailored to your syllabus. Focus on the core definition first, then connect it to an example from your notes.",
    source:
      "DBMS Unit 3 — Normalization, pp. 12–14: \"A relation is in 3NF if it is in 2NF and no non-key attribute is transitively dependent on the primary key.\"",
  },
  normalization: {
    answer:
      "Third Normal Form (3NF) builds on 2NF by removing transitive dependencies. If a non-key column depends on another non-key column rather than the primary key, you should split that into a separate table.",
    source:
      "DBMS Unit 3 — Normalization, pp. 12–14: \"3NF eliminates transitive dependency between non-key attributes.\"",
  },
  scheduling: {
    answer:
      "FCFS serves processes in arrival order — simple but can cause convoy effect. Round Robin adds a time quantum so no process monopolizes the CPU, improving response time for interactive workloads.",
    source:
      "Operating Systems — Scheduling, pp. 6–8: \"Round Robin is designed for time-sharing systems with a fixed time slice.\"",
  },
  bfs: {
    answer:
      "BFS explores level by level using a queue — ideal for shortest path in unweighted graphs. DFS goes deep first with a stack/recursion — useful for cycle detection and topological sort.",
    source:
      "Data Structures — Trees & Graphs, pp. 21–23: \"BFS uses FIFO queue; DFS uses LIFO stack.\"",
  },
  aptitude: {
    answer:
      "Start with 20 minutes daily on percentages, ratios, and logical sequences. Use timed mini-mocks twice a week and review mistakes immediately — pattern recognition matters more than volume.",
    source:
      "Placement Prep — Aptitude Basics, pp. 2–4: \"Consistent short sessions outperform cramming for aptitude.\"",
  },
};

export const MOCK_WEEK_SCHEDULE = [
  {
    id: "sch-1",
    day: "Mon",
    start: "09:00",
    end: "10:30",
    title: "OS — CPU Scheduling",
    reason: "weak subject",
  },
  {
    id: "sch-2",
    day: "Mon",
    start: "14:00",
    end: "15:00",
    title: "DBMS assignment",
    reason: "deadline in 2 days",
  },
  {
    id: "sch-3",
    day: "Tue",
    start: "10:00",
    end: "11:30",
    title: "DSA — Graph problems",
    reason: "weak subject",
  },
  {
    id: "sch-4",
    day: "Wed",
    start: "16:00",
    end: "17:00",
    title: "Resume keyword review",
    reason: "placement readiness",
  },
  {
    id: "sch-5",
    day: "Thu",
    start: "11:00",
    end: "12:30",
    title: "Mock aptitude test",
    reason: "placement readiness",
  },
  {
    id: "sch-6",
    day: "Fri",
    start: "09:00",
    end: "10:00",
    title: "Mentor check-in prep",
    reason: "academic support",
  },
  {
    id: "sch-7",
    day: "Sat",
    start: "15:00",
    end: "16:30",
    title: "Project documentation",
    reason: "deadline in 2 days",
  },
];

export const MOCK_STUDENTS = [
  {
    id: "s-1",
    name: "Alex Chen",
    email: "student@campus.edu",
    branch: "Computer Science",
    academicRisk: 0.38,
    placementReadiness: 0.68,
    topFactor: "Inconsistent assignment submissions",
    resumeScore: 74,
    year: "3rd Year",
    gpa: "3.4",
  },
  {
    id: "s-2",
    name: "Jordan Lee",
    email: "jordan@campus.edu",
    branch: "Information Technology",
    academicRisk: 0.72,
    placementReadiness: 0.41,
    topFactor: "Low attendance in core subjects",
    resumeScore: 52,
    year: "3rd Year",
    gpa: "2.6",
  },
  {
    id: "s-3",
    name: "Samira Khan",
    email: "samira@campus.edu",
    branch: "Computer Science",
    academicRisk: 0.22,
    placementReadiness: 0.85,
    topFactor: "Strong projects, minor gap in aptitude",
    resumeScore: 81,
    year: "4th Year",
    gpa: "3.8",
  },
  {
    id: "s-4",
    name: "Ravi Menon",
    email: "ravi@campus.edu",
    branch: "Electronics & CS",
    academicRisk: 0.55,
    placementReadiness: 0.58,
    topFactor: "Mid-term slump in mathematics",
    resumeScore: 63,
    year: "3rd Year",
    gpa: "3.0",
  },
  {
    id: "s-5",
    name: "Taylor Brooks",
    email: "taylor@campus.edu",
    branch: "Information Technology",
    academicRisk: 0.81,
    placementReadiness: 0.35,
    topFactor: "Multiple backlogs in semester 5",
    resumeScore: 45,
    year: "3rd Year",
    gpa: "2.2",
  },
];

export const MOCK_COHORT_STATS = {
  studentsOverseen: 48,
  currentlyFlagged: 7,
  interventionsThisMonth: 12,
  riskDistribution: [
    { bucket: "Low", count: 18, fill: "#5a8f7b" },
    { bucket: "Moderate", count: 21, fill: "#c4923a" },
    { bucket: "Elevated", count: 9, fill: "#b85c5c" },
  ],
};

export const MOCK_INTERVENTIONS = {
  "s-1": [
    {
      id: "int-1",
      action: "Study plan review",
      actionNote: "Created weekly OS + DBMS revision blocks; paired with peer study group.",
      riskBefore: 0.52,
      riskAfter: 0.38,
      reviewDate: "2026-07-20",
      createdAt: "2026-07-01",
    },
    {
      id: "int-2",
      action: "Resume feedback session",
      actionNote: "Highlighted missing DevOps keywords; assigned mock project bullet rewrite.",
      riskBefore: 0.45,
      riskAfter: 0.38,
      reviewDate: "2026-07-15",
      createdAt: "2026-06-18",
    },
  ],
  "s-2": [
    {
      id: "int-3",
      action: "Attendance follow-up",
      actionNote: "Met with student; referred to academic advisor for attendance waiver process.",
      riskBefore: 0.78,
      riskAfter: 0.72,
      reviewDate: "2026-07-18",
      createdAt: "2026-07-05",
    },
  ],
  "s-3": [],
  "s-4": [
    {
      id: "int-4",
      action: "Tutoring referral",
      actionNote: "Connected with math tutoring center; added 2 extra practice sessions per week.",
      riskBefore: 0.62,
      riskAfter: 0.55,
      reviewDate: "2026-07-22",
      createdAt: "2026-06-30",
    },
  ],
  "s-5": [
    {
      id: "int-5",
      action: "Backlog recovery plan",
      actionNote: "Structured summer backlog clearance schedule with milestone check-ins.",
      riskBefore: 0.88,
      riskAfter: 0.81,
      reviewDate: "2026-07-25",
      createdAt: "2026-07-08",
    },
  ],
};

export const INTERVENTION_ACTIONS = [
  "Study plan review",
  "Resume feedback session",
  "Attendance follow-up",
  "Tutoring referral",
  "Backlog recovery plan",
  "Career counseling",
  "Wellness check-in",
];

export const createMockToken = (user) =>
  `mock-jwt-${user.id}-${user.role}-${Date.now()}`;

export const parseMockToken = (token) => {
  if (!token?.startsWith("mock-jwt-")) return null;
  const parts = token.split("-");
  const role = parts[parts.length - 2];
  const idParts = parts.slice(2, parts.length - 2);
  const id = idParts.join("-");
  const user = mockUsers.find((u) => u.id === id);
  if (!user) return null;
  return { ...user, token };
};
