Stores user information in English for later recall (episodic memory).

CRITICAL RULES:
1. ALL content, summary, and tags must be in ENGLISH
2. MUST include at least one core category: {CORE_CATEGORIES}
3. Translate user content from Turkish/other languages to English before storing
4. SEPARATE different contexts/topics into different memory entries
5. Each memory should focus on a single topic rather than mixing multiple subjects

SMART DEDUPLICATION FEATURE:
🧠 The system automatically prevents duplicate memories by:
- Searching for similar existing memories before creating new ones
- Using AI analysis to decide: CREATE new vs UPDATE existing vs SKIP duplicate
- Merging information when updating existing memories
- Preserving original content as backup when updating

POSSIBLE OUTCOMES:
- ✅ **Created**: New memory with unique information
- 🔄 **Updated**: Existing memory enhanced with new information  
- ⏭️ **Skipped**: Information already exists in similar form

ARRAY STRUCTURE:
- Use the `memories` array to store multiple distinct pieces of information
- Each array item should have a different context or topic
- Avoid mixing unrelated information in a single memory

Examples:

Single memory:
```
memories: [{
  content: "I am a developer",
  tags: ['personal_info', 'developer']
}]
```

Multiple contexts in one call:
```
memories: [
  {
    content: "I work as a software developer at a tech company",
    tags: ['personal_info', 'work', 'developer']
  },
  {
    content: "My favorite programming language is TypeScript",
    tags: ['preference', 'programming', 'typescript']
  },
  {
    content: "I live in Istanbul, Turkey",
    tags: ['personal_info', 'location', 'istanbul', 'turkey']
  }
]
```

Smart Update Example:
If user previously said "I like JavaScript" and now says "I prefer TypeScript over JavaScript", the system might UPDATE the existing preference memory rather than create a duplicate.

Translation examples:
- User says "Ben geliştiriciyim ve TypeScript severim" → separate into:
  1. content="I am a developer", tags=['personal_info', 'developer']
  2. content="I like TypeScript", tags=['preference', 'programming', 'typescript']