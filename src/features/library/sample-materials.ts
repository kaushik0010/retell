export interface SampleStudyMaterial {
  id: string;
  category: string;
  title: string;
  description: string;
  sourceText: string;
}

export const SAMPLE_STUDY_MATERIALS: SampleStudyMaterial[] = [
  {
    id: "sample_dns_resolution",
    category: "Computer Networks",
    title: "Computer Networks: The DNS Resolution Process",
    description:
      "Recursive vs iterative queries, root servers, TLD servers, and caching.",
    sourceText: `The Domain Name System (DNS) is a hierarchical, distributed naming system that translates human-friendly domain names (such as www.example.com) into numerical IP addresses required for network routing.

When a client browser initiates a query, it first checks its local OS resolver cache. If the entry is not cached, the client sends a recursive query to a configured recursive DNS resolver (typically hosted by an ISP or public provider like 1.1.1.1).

The recursive resolver performs an iterative resolution sequence:
1. First, the resolver queries one of the 13 logical Root DNS Servers. The root server does not know the IP address, but inspects the Top-Level Domain (TLD) label (.com) and responds with a referral to the appropriate TLD nameservers.
2. Next, the recursive resolver queries the .com TLD nameserver. The TLD server responds with a referral to the Authoritative Name Server responsible for example.com (the second-level domain).
3. Finally, the recursive resolver contacts the Authoritative Name Server for example.com. The authoritative server holds the actual DNS zone records (such as 'A' records for IPv4 or 'AAAA' records for IPv6) and returns the final mapped IP address.

The recursive resolver caches this record for the duration specified by the Time-To-Live (TTL) header before delivering the answer back to the client. This caching significantly reduces query latency and upstream traffic on root and TLD infrastructure.`,
  },
  {
    id: "sample_react_reconciliation",
    category: "Software Engineering",
    title: "React Architecture: Reconciliation and the Fiber Engine",
    description:
      "Virtual DOM diffing, Fiber tree nodes, concurrent work, and commit phases.",
    sourceText: `React uses a virtual representation of the UI called the Virtual DOM to optimize DOM mutations through a process known as reconciliation.

Prior to React 16, reconciliation was performed using a recursive stack reconciler that could not be interrupted once started, occasionally causing dropped frames during complex updates.

React 16 introduced the Fiber architecture, a complete rewrite of the reconciliation algorithm. A Fiber is a JavaScript object representing a unit of work that corresponds directly to a component or DOM element in the UI tree.

The reconciliation cycle is split into two distinct phases:
1. The Render Phase (Work Loop): In this asynchronous, interruptible phase, React traverses the fiber work-in-progress tree, calls component functions, calculates diffs, and assigns effect tags (such as Placement, Update, or Deletion). Because this phase is pure and creates no visible side effects, React can pause, abort, or prioritize work based on user input (such as typing or clicks) via scheduler priorities.
2. The Commit Phase: Once the render phase completes and all work is calculated, React enters the synchronous commit phase. During commit, React applies all accumulated side effects and DOM mutations in a single, uninterrupted batch to ensure UI consistency, followed by lifecycle hooks (componentDidMount, useLayoutEffect) and passive effects (useEffect).

Reconciliation relies on heuristic algorithms with O(n) complexity rather than O(n^3), assuming that elements of different types generate different trees, and using stable 'key' props to track identity across re-orders.`,
  },
  {
    id: "sample_atp_synthase",
    category: "Biochemistry",
    title: "Biochemistry: ATP Synthase and Chemiosmotic Coupling",
    description:
      "Proton motive force, F0 rotor, F1 catalytic domain, and rotary catalysis.",
    sourceText: `Cellular respiration culminates in oxidative phosphorylation, where the synthesis of adenosine triphosphate (ATP) is coupled to the transfer of electrons along the electron transport chain (ETC) in the inner mitochondrial membrane.

As electrons pass through Complexes I, III, and IV, energy is released to pump protons (H+) from the mitochondrial matrix across the inner membrane into the intermembrane space. This creates an electrochemical gradient across the membrane known as the Proton Motive Force (PMF), consisting of both a pH gradient (chemical potential) and an electrical membrane potential.

ATP Synthase (Complex V) is a molecular rotary motor that harnesses this proton motive force to synthesize ATP from ADP and inorganic phosphate (Pi) via chemiosmosis:
- The enzyme consists of two primary functional domains: the membrane-embedded F0 domain and the soluble catalytic F1 domain located in the matrix.
- Protons enter an inlet half-channel in subunit 'a' of the F0 domain, protonate a conserved carboxyl group on a 'c' subunit of the c-ring rotor, causing the rotor to rotate mechanically as protons complete a full circle and exit through the second half-channel into the matrix.
- The rotation of the c-ring turns the central stalk (gamma and epsilon subunits) attached to it.
- The asymmetric gamma subunit rotates inside the stationary hexameric (alpha-beta)3 catalytic head of the F1 domain. This mechanical movement forces conformational changes in the three catalytic beta subunits through three distinct states: Open (empty/releasing ATP), Loose (binding ADP and Pi), and Tight (catalyzing the formation of ATP).`,
  },
  {
    id: "sample_oauth_pkce",
    category: "Security Engineering",
    title: "Security: OAuth 2.0 Authorization Code Flow with PKCE",
    description:
      "Code verifier, code challenge, authorization grant, and token exchange.",
    sourceText: `The OAuth 2.0 Authorization Code Flow with Proof Key for Code Exchange (PKCE, RFC 7636) is the gold standard security protocol for authenticating users and obtaining access tokens in public clients, such as Single Page Applications (SPAs) and mobile apps, where client secrets cannot be securely stored.

The protocol prevents authorization code interception attacks through the use of a dynamic cryptographic challenge:
1. Initiation: The client generates a cryptographically random string known as the Code Verifier (high-entropy, 43 to 128 characters).
2. Transformation: The client computes the Code Challenge by hashing the Code Verifier using SHA-256 and Base64URL-encoding the digest (code_challenge_method = S256).
3. Authorization Request: The client redirects the user's browser to the Authorization Server's /authorize endpoint, including the client_id, redirect_uri, response_type=code, requested scopes, state parameter (to defend against CSRF), and the code_challenge + code_challenge_method.
4. User Consent & Code Issuance: The user authenticates and grants consent. The authorization server redirects back to the client's redirect_uri with a temporary authorization code and the state token.
5. Token Exchange: The client makes a direct POST request to the token endpoint (/token), presenting the authorization code, client_id, redirect_uri, and the raw plaintext code_verifier.
6. Server Verification: The authorization server hashes the received code_verifier with SHA-256 and compares it to the previously stored code_challenge. If they match, it confirms that the entity redeeming the code is the identical client that initiated the request, and issues the Access Token and optional Refresh Token.`,
  },
];
