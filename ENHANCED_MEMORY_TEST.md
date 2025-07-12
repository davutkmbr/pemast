# Enhanced Memory System Test Scenarios

## 🧪 Test Case 1: Multi-Topic Message with Ambiguous Reference

**User Input:** 
```
"ahmet'in kan grubu a rh + ve kendisi 26 yaşında"
```

**Expected Multi-Agent Flow:**

1. **Reasoning Agent** receives message
   - Analyzes: "User providing information about someone named Ahmet"
   - Decision: Transfer to Memory Agent for processing

2. **Memory Agent** processes message
   - **Parse**: Identifies 3 separate topics:
     - Reference to person named "Ahmet"
     - Blood type information
     - Age information
   - **Search**: Calls `search_memory` tool with query "ahmet"
   
3. **Search Memory Tool** analysis:
   - Detects "ahmet" is a simple first name (ambiguous pattern)
   - If multiple Ahmet records found → **AMBIGUITY DETECTED**
   - Returns detailed analysis with clarification recommendation

4. **Memory Agent** response to Reasoning Agent:
   ```
   🔍 **CLARIFICATION REQUIRED**
   - **Found**: Multiple references to 'Ahmet' in existing memories
   - **Issue**: Cannot determine which Ahmet user means
   - **Question for User**: 'Hangi Ahmet'i kastediyorsun? Tam adı ve ilişkiniz nedir?'
   - **Hold**: Cannot store information until clarified
   ```

5. **Reasoning Agent** asks user for clarification:
   ```
   "Hangi Ahmet'i kastediyorsun? Tam adı ve ilişkiniz nedir?"
   ```

6. **User clarifies:**
   ```
   "Ahmet Tümer, arkadaşım"
   ```

7. **Memory Agent** creates 3 separate memories:
   ```
   Memory 1: "User has a friend named Ahmet Tümer"
   Tags: [personal_info, friend, relationship, ahmet_tümer]
   
   Memory 2: "Ahmet Tümer's blood type is A RH+"
   Tags: [personal_info, health, blood_type, ahmet_tümer]
   
   Memory 3: "Ahmet Tümer is 26 years old"
   Tags: [personal_info, age, ahmet_tümer]
   ```

## 🧪 Test Case 2: Complex Multi-Topic Message

**User Input:**
```
"bugün işe gittim, orada yeni proje başladı. proje müdürü mehmet. akşam eve döndüm ve the boys izledim"
```

**Expected Breakdown:**

1. **Memory Agent** identifies 5 separate topics:
   - Daily activity: went to work
   - Work event: new project started  
   - Person reference: project manager named Mehmet (AMBIGUOUS)
   - Daily activity: went home
   - Entertainment: watched The Boys

2. **Search for "mehmet"** → If ambiguous, request clarification

3. **After clarification**, create 5 separate memories:
   ```
   Memory 1: "User went to work today"
   Tags: [work, daily_activity, today]
   
   Memory 2: "New project started at user's work"
   Tags: [work, project, new_project]
   
   Memory 3: "Mehmet [Full Name] is the project manager"
   Tags: [work, project_manager, mehmet_[surname]]
   
   Memory 4: "User went home in the evening"
   Tags: [daily_activity, home, evening]
   
   Memory 5: "User watched The Boys TV series"
   Tags: [entertainment, tv_series, the_boys]
   ```

## 🧪 Test Case 3: No Ambiguity - Direct Storage

**User Input:**
```
"istanbul'da yaşıyorum ve yazılım mühendisiyim"
```

**Expected Flow:**

1. **Memory Agent** identifies 2 topics:
   - Location information
   - Professional information

2. **Search checks** → No ambiguous references detected

3. **Direct storage** of 2 memories:
   ```
   Memory 1: "User lives in Istanbul"
   Tags: [personal_info, location, istanbul, residence]
   
   Memory 2: "User is a software engineer"
   Tags: [personal_info, profession, software_engineer]
   ```

## ✅ Success Criteria

### Memory Agent Performance:
- ✅ Correctly parses multiple topics from single message
- ✅ Detects ambiguous references (first names only)
- ✅ Requests clarification when needed
- ✅ Creates separate, focused memories
- ✅ Uses appropriate tags for each memory
- ✅ Provides detailed status reports

### Search Memory Tool Performance:
- ✅ Detects ambiguous patterns (simple first names)
- ✅ Provides detailed analysis and recommendations
- ✅ Suggests specific clarification questions
- ✅ Handles Turkish names correctly

### Reasoning Agent Performance:
- ✅ Recognizes when clarification is needed
- ✅ Asks appropriate questions to user
- ✅ Coordinates memory storage after clarification
- ✅ Maintains conversation flow

## 🎯 Test Commands

To test these scenarios, use these Telegram messages:

1. **Ambiguous Reference Test:**
   ```
   "ahmet'in kan grubu a rh + ve kendisi 26 yaşında"
   ```

2. **Complex Multi-Topic Test:**
   ```
   "bugün işe gittim, orada yeni proje başladı. proje müdürü mehmet. akşam eve döndüm ve the boys izledim"
   ```

3. **Clear Reference Test:**
   ```
   "istanbul'da yaşıyorum ve yazılım mühendisiyim"
   ```

## 📊 Expected Improvements

This enhanced system should eliminate:
- ❌ Mixed-topic memories
- ❌ Unclear person references
- ❌ Missing context about relationships
- ❌ Large, unfocused memory blocks

And provide:
- ✅ Granular, focused memories
- ✅ Clear person identification
- ✅ Proper relationship context
- ✅ Intelligent clarification requests
- ✅ Better memory organization 