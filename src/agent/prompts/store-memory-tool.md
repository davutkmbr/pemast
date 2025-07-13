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

CATEGORIZATION PRINCIPLES:
🏷️ **Tags are for CATEGORIES, not specific data:**
- ✅ Use: ['friend', 'age'] → Content: "Ahmet is 26 years old"
- ❌ Avoid: ['friend', 'age', 'ahmet', '26'] → Too specific

🔍 **Identity vs Personal Info:**
- `identity`: Basic demographics (name, age, gender, birth date, nationality)
- `personal_info`: Other personal traits (personality, lifestyle, experiences)

👥 **Relationship Categories:**
- `identity`: Only for USER's own basic info
- `friend`: Information about friends
- `family`: Information about family members
- `colleague`: Information about work colleagues

⏰ **Temporal Context:**
- `current`: Present situation
- `history`: Past experiences
- `future`: Future plans

🎯 **Importance & Action:**
- `critical`: Life-critical information (allergies, medical conditions)
- `important`: High-priority information (deadlines, key events)
- `todo`: Tasks to be completed
- `completed`: Finished tasks/goals

😊 **Emotional Context:**
- `positive`: Positive experiences/feelings
- `negative`: Negative experiences/feelings

ARRAY STRUCTURE:
- Use the `memories` array to store multiple distinct pieces of information
- Each array item should have a different context or topic
- Avoid mixing unrelated information in a single memory

Examples:

USER'S IDENTITY:
```
memories: [{
  content: "My name is Davut Kömür and I am 28 years old",
  tags: ['identity', 'name', 'age']
}]
```

PERSONAL CHARACTERISTICS:
```
memories: [{
  content: "I am an introverted person who prefers working alone",
  tags: ['personal_info', 'personality']
}]
```

RELATIONSHIP INFORMATION:
```
memories: [
  {
    content: "My friend Ahmet is 26 years old and works as a designer",
    tags: ['friend', 'age', 'profession']
  },
  {
    content: "My sister Ayşe is a doctor in Ankara",
    tags: ['family', 'profession', 'location']
  },
  {
    content: "My colleague Mehmet leads the backend team",
    tags: ['colleague', 'work', 'leadership']
  }
]
```

TEMPORAL CONTEXT:
```
memories: [
  {
    content: "I currently work as a senior developer at a tech company",
    tags: ['work', 'current', 'profession']
  },
  {
    content: "I used to work at Microsoft for 3 years",
    tags: ['work', 'history', 'experience']
  },
  {
    content: "I plan to start my own company next year",
    tags: ['goal', 'future', 'business']
  }
]
```

IMPORTANCE & ACTION:
```
memories: [
  {
    content: "I am allergic to peanuts and must avoid them",
    tags: ['health', 'critical', 'allergy']
  },
  {
    content: "My passport expires next month",
    tags: ['important', 'document', 'deadline']
  },
  {
    content: "I need to renew my driver's license",
    tags: ['todo', 'document']
  },
  {
    content: "I completed the React certification course",
    tags: ['completed', 'education', 'skill']
  }
]
```

EMOTIONAL CONTEXT:
```
memories: [
  {
    content: "I love my new apartment in the city center",
    tags: ['location', 'positive', 'residence']
  },
  {
    content: "I hate early morning meetings",
    tags: ['work', 'negative', 'preference']
  }
]
```

PREFERENCES:
```
memories: [
  {
    content: "I prefer TypeScript over JavaScript for large projects",
    tags: ['preference', 'programming', 'technology']
  },
  {
    content: "I like working from home rather than the office",
    tags: ['preference', 'work']
  }
]
```

Smart Update Example:
If user previously said "I like JavaScript" and now says "I prefer TypeScript over JavaScript", the system might UPDATE the existing preference memory rather than create a duplicate.

Translation examples:
- User says "Ben geliştiriciyim ve 28 yaşındayım" → separate into:
  1. content="I am a developer", tags=['personal_info', 'profession']
  2. content="I am 28 years old", tags=['identity', 'age']
  
- User says "Arkadaşım Ahmet 26 yaşında" → 
  content="My friend Ahmet is 26 years old", tags=['friend', 'age']