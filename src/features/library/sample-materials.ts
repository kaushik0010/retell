export interface SampleStudyMaterial {
  id: string;
  category: string;
  title: string;
  description: string;
  sourceText: string;
}

export const SAMPLE_STUDY_MATERIALS: SampleStudyMaterial[] = [
  {
    id: "sample_os_page_replacement",
    category: "Computer Science",
    title: "Operating Systems: Page Replacement Algorithms",
    description:
      "FIFO, LRU, Optimal algorithms, Belady's anomaly, and tradeoffs.",
    sourceText: `Question:
Explain the different page replacement algorithms and compare their advantages and disadvantages.

Answer (from your material):
Page replacement algorithms decide which page to remove from memory when a page fault occurs. Common algorithms include FIFO, LRU, and Optimal.

1. First-In, First-Out (FIFO): Replaces the oldest page in memory. It is simple to implement using a queue, but can suffer from Belady's anomaly where allocating more page frames actually causes more page faults.
2. Least Recently Used (LRU): Replaces the page that has not been accessed for the longest period of time. It provides high performance by approximating the principle of locality, but requires hardware assistance such as counters or stack manipulation.
3. Optimal Page Replacement (OPT): Replaces the page that will not be used for the longest duration in the future. It provides the theoretical lowest page-fault rate, but is practically impossible to implement in real operating systems because future memory reference strings cannot be predicted in advance.`,
  },
  {
    id: "sample_dns_resolution",
    category: "Networking",
    title: "Computer Networks: The DNS Resolution Process",
    description:
      "Root servers, TLD servers, authoritative nameservers, and TTL caching.",
    sourceText: `Question:
Describe the sequence of servers a recursive resolver queries to resolve a domain name into an IP address.

Answer (from your material):
The Domain Name System (DNS) translates human-friendly domain names (e.g., www.example.com) into numerical IP addresses. When a client resolver does not find an entry in its local cache, it queries a recursive DNS resolver, which performs an iterative lookup sequence:

1. Root Server: The recursive resolver first contacts one of the 13 logical Root DNS Servers. The root server inspects the top-level domain (.com) and refers the resolver to the appropriate TLD nameserver.
2. TLD Nameserver: The resolver contacts the .com TLD nameserver, which identifies the Authoritative Name Server responsible for example.com.
3. Authoritative Name Server: The resolver contacts the Authoritative Name Server, which holds the official zone records (A/AAAA) and returns the final mapped IP address.
4. Caching & Return: The recursive resolver caches this mapping for the duration specified by the Time-To-Live (TTL) header and delivers the resolved IP address to the client browser.`,
  },
  {
    id: "sample_react_reconciliation",
    category: "Software Engineering",
    title: "React Architecture: Reconciliation & Fiber Engine",
    description:
      "Virtual DOM diffing, Fiber tree nodes, interruptible work, and commit phases.",
    sourceText: `Question:
Describe the two phases of React Fiber reconciliation and explain why this architecture was introduced.

Answer (from your material):
React Fiber is a complete rewrite of React's core reconciliation algorithm designed to enable incremental rendering and prevent UI frame drops during complex updates.

1. The Render Phase (Work Loop): An asynchronous, interruptible phase where React traverses the Fiber tree, calls component functions, calculates Virtual DOM diffs, and assigns effect tags (Placement, Update, Deletion). Because this phase produces no visible side effects, React can pause, abort, or prioritize work based on user input priority via scheduler lanes.
2. The Commit Phase: A synchronous, uninterrupted phase where React applies all accumulated side effects and DOM mutations in a single batch to guarantee visual consistency. Once the DOM is updated, React triggers synchronous layout effects (useLayoutEffect) followed by passive effects (useEffect).

Fiber achieves O(n) heuristic diffing by assuming different element types generate distinct subtrees and using stable 'key' props to track element identity across re-orders.`,
  },
  {
    id: "sample_atp_synthase",
    category: "Biochemistry",
    title: "Biochemistry: ATP Synthase & Chemiosmosis",
    description:
      "Proton motive force, F0 rotor, F1 catalytic domain, and rotational catalysis.",
    sourceText: `Question:
Explain how the proton motive force powers ATP synthesis through the structural domains of ATP Synthase.

Answer (from your material):
Oxidative phosphorylation couples electron transfer in the inner mitochondrial membrane to ATP generation via an electrochemical gradient known as the Proton Motive Force (PMF).

1. Proton Motive Force: Complexes I, III, and IV pump protons (H+) from the mitochondrial matrix into the intermembrane space, generating both a chemical pH difference and an electrical membrane potential.
2. F0 Membrane Rotor: Protons enter an inlet half-channel in subunit 'a' of the F0 domain, protonate a conserved carboxyl group on a 'c' subunit of the c-ring rotor, causing the rotor to rotate mechanically as protons complete a revolution and exit into the matrix through the second half-channel.
3. F1 Catalytic Head: Rotation of the c-ring drives the asymmetric central stalk (gamma subunit) inside the stationary hexameric (alpha-beta)3 catalytic head in the matrix.
4. Binding Change Mechanism: The turning gamma stalk forces conformational changes in the three catalytic beta subunits through Open (empty/release), Loose (bind ADP and Pi), and Tight (catalyze ATP formation) states.`,
  },
];
