// Lightweight smoke test verifying live extraction and rubric generation
const metaKey = process.env.META_MODEL_API_KEY;
const basetenKey = process.env.BASETEN_API_KEY;
const reasoningModel = process.env.META_REASONING_MODEL || "muse-spark-1.3";

console.log("=================================================");
console.log("  Live Ingestion & Rubric Generation Smoke Test  ");
console.log("=================================================");

if (!metaKey && !basetenKey) {
  console.error("No API keys found in environment.");
  process.exit(1);
}

const sampleText = `The Domain Name System (DNS) is a hierarchical naming system that translates domain names into IP addresses.
When a client queries a domain, a recursive resolver queries a Root DNS Server, which refers it to the Top-Level Domain (TLD) server (such as .com).
The TLD server refers the resolver to the Authoritative Name Server for the domain, which returns the actual IP address mapped in an A record.
The recursive resolver caches the result according to its Time-To-Live (TTL) to speed up future requests.`;

async function testLiveExtraction() {
  console.log(
    "\n[1/2] Testing Live Question Extraction with " + reasoningModel + "..."
  );
  const startTime = Date.now();

  const payload = {
    model: reasoningModel,
    messages: [
      {
        role: "system",
        content: `You are an expert exam creator for Retell. Extract 1 or 2 conceptual questions and source-grounded reference answers. Return ONLY JSON conforming to:
{
  "suggestedTitle": "Title",
  "questions": [
    {
      "question": "Question text...",
      "referenceAnswer": "Answer text...",
      "sourceExcerpt": "Quote..."
    }
  ]
}`,
      },
      {
        role: "user",
        content: `SOURCE MATERIAL:\n${sampleText}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  };

  const res = await fetch("https://api.meta.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${metaKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const latency = Date.now() - startTime;
  if (!res.ok) {
    const errText = await res.text();
    console.error(`  -> Failed (${latency}ms): ${res.status} - ${errText}`);
    return null;
  }

  const data = await res.json();
  const content = data.choices[0].message.content;
  const parsed = JSON.parse(content);
  console.log(
    `  -> Verified (${latency}ms): Extracted ${parsed.questions.length} questions`
  );
  console.log(`  -> Title: "${parsed.suggestedTitle}"`);
  console.log(`  -> Sample Q1: "${parsed.questions[0].question}"`);
  return parsed;
}

async function testLiveRubric(questionObj) {
  console.log(
    "\n[2/2] Testing Live Rubric Generation with " + reasoningModel + "..."
  );
  const startTime = Date.now();

  const payload = {
    model: reasoningModel,
    messages: [
      {
        role: "system",
        content: `You are an expert exam evaluator. Generate a structured rubric with 3 to 5 criteria across: essential_concept, technical_anchor, relationship_sequence, accuracy_constraint, optional_detail.
Return ONLY JSON conforming to:
{
  "criteria": [
    {
      "category": "essential_concept",
      "name": "Criterion Name",
      "description": "Criterion description",
      "satisfactoryDemonstration": "How a student satisfies this in their own words accepting paraphrasing",
      "isMandatory": true
    }
  ]
}`,
      },
      {
        role: "user",
        content: `QUESTION: ${questionObj.question}\nREFERENCE ANSWER: ${questionObj.referenceAnswer}\nSOURCE CONTEXT: ${sampleText}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  };

  const res = await fetch("https://api.meta.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${metaKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const latency = Date.now() - startTime;
  if (!res.ok) {
    const errText = await res.text();
    console.error(`  -> Failed (${latency}ms): ${res.status} - ${errText}`);
    return;
  }

  const data = await res.json();
  const content = data.choices[0].message.content;
  const parsed = JSON.parse(content);
  console.log(
    `  -> Verified (${latency}ms): Generated ${parsed.criteria.length} criteria`
  );
  for (const crit of parsed.criteria) {
    console.log(
      `     • [${crit.category}] ${crit.name}: ${crit.satisfactoryDemonstration.slice(0, 60)}...`
    );
  }
}

async function run() {
  const extraction = await testLiveExtraction();
  if (extraction && extraction.questions[0]) {
    await testLiveRubric(extraction.questions[0]);
  }
  console.log("\n=================================================");
  console.log("  Smoke Test Completed Successfully              ");
  console.log("=================================================");
}

run().catch(console.error);
