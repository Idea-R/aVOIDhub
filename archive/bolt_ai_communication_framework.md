# Bolt AI Communication Framework for aVOID Project

## 🎯 **CORE PRINCIPLES FOR BOLT SUCCESS**

### **1. The 500-Line Rule (CRITICAL)**
- **Never** ask Bolt to edit files >500 lines
- **Always** refactor large files into modules first
- **Target**: 200-400 lines per file for optimal Bolt performance

### **2. Single Responsibility Prompts**
- **One objective** per prompt
- **One file focus** per request
- **Clear success criteria** defined upfront

### **3. Preservation-First Approach**
- **Explicitly state** what to preserve
- **List existing features** that must remain unchanged
- **Reference specific functions/components** to maintain

## 📋 **BOLT PROMPT TEMPLATE SYSTEM**

### **Template A: New Feature Creation**
```
OBJECTIVE: Create [specific feature name]

CONTEXT:
- Project: aVOID browser dodge game
- Tech stack: React + TypeScript + Supabase + Tailwind CSS
- Performance target: 60fps
- Mobile compatibility required

REQUIREMENTS:
1. [Specific requirement 1]
2. [Specific requirement 2]
3. [Performance consideration]
4. [Mobile consideration]

CONSTRAINTS:
- File size limit: 400 lines maximum
- Must integrate with existing [system/component]
- Preserve existing [functionality/API]

AVOID:
- Duplicating existing [features/components]
- Breaking current [game mechanics/UI]
- Performance regressions

SUCCESS CRITERIA:
- [Measurable outcome 1]
- [Measurable outcome 2]
```

### **Template B: Modification/Enhancement**
```
OBJECTIVE: Enhance existing [component/system name]

CURRENT STATE:
- File: [filepath]
- Current functionality: [brief description]
- Lines: [current line count]

SPECIFIC CHANGES:
- ADD: [what to add]
- MODIFY: [what to change]
- PRESERVE: [what must stay unchanged]

INTEGRATION POINTS:
- Must work with: [existing systems]
- API compatibility: [requirements]
- State management: [considerations]

PERFORMANCE REQUIREMENTS:
- [specific performance needs]
- Mobile optimization: [requirements]

TESTING CONSIDERATIONS:
- [what to verify works]
```

### **Template C: Refactoring for Bolt**
```
OBJECTIVE: Refactor [large file] into smaller modules

CURRENT FILE: [filepath] ([current line count] lines)

SPLIT STRATEGY:
Module 1: [name] (~[target lines] lines)
- Responsibilities: [list]
- Exports: [interfaces/functions]

Module 2: [name] (~[target lines] lines)
- Responsibilities: [list]
- Exports: [interfaces/functions]

PRESERVATION REQUIREMENTS:
- All existing functionality unchanged
- Same external API
- Performance maintained or improved

POST-REFACTOR INTEGRATION:
- Update imports in: [list of files]
- Maintain: [existing interfaces]
```

## 🚨 **BOLT PITFALL AVOIDANCE STRATEGIES**

### **1. File Size Management**
```bash
# PRE-BOLT CHECKLIST:
✓ File <500 lines?
✓ Single responsibility?
✓ Clear interfaces defined?
✓ Dependencies minimized?
```

### **2. Context Preservation**
```typescript
// ALWAYS provide this context in prompts:
"This file is part of aVOID game engine which:
- Manages [specific responsibility]
- Integrates with [other systems]
- Must maintain [performance requirements]
- Current dependencies: [list]"
```

### **3. Breaking Changes Prevention**
```
PROTECTION STRATEGY:
1. List ALL existing function signatures
2. Specify ALL existing component props
3. Detail ALL current integrations
4. Mention ALL performance requirements
```

## 📱 **MOBILE-SPECIFIC BOLT PROMPTING**

### **Mobile Enhancement Template**
```
MOBILE OPTIMIZATION REQUEST:

TARGET DEVICES:
- Smartphones (iOS/Android)
- Touch input only
- Performance constraints

SPECIFIC MOBILE NEEDS:
- Touch event handling: [requirements]
- Responsive breakpoints: [list]
- Performance limits: [mobile-specific]
- UI adaptations: [needed changes]

RESPONSIVE STRATEGY:
- Hide on mobile: [elements]
- Adapt on mobile: [behaviors]
- Optimize for touch: [interactions]

PERFORMANCE TARGETS:
- Mobile frame rate: 45+ fps
- Touch response: <100ms
- Memory usage: conservative
```

## ⚡ **PERFORMANCE-FOCUSED BOLT PROMPTS**

### **Performance Template**
```
PERFORMANCE OPTIMIZATION REQUEST:

CURRENT PERFORMANCE ISSUE:
- Problem: [specific issue]
- Impact: [measured effect]
- Target improvement: [specific goal]

OPTIMIZATION REQUIREMENTS:
- Frame rate: 60fps desktop, 45fps mobile
- Memory: minimal allocation in game loop
- Rendering: batched operations preferred

CONSTRAINTS:
- No breaking changes to game logic
- Maintain visual quality on desktop
- Degrade gracefully on mobile

MEASUREMENT:
- Success metric: [how to measure]
- Testing approach: [verification method]
```

## 🔧 **SYSTEMATIC BOLT WORKFLOW**

### **Phase 1: Pre-Bolt Preparation**
1. **Analyze current file sizes** (`Get-ChildItem -Recurse | Sort Length`)
2. **Identify files >500 lines** requiring refactoring
3. **Create refactoring plan** with target module sizes
4. **Document existing functionality** to preserve

### **Phase 2: Bolt Task Structuring**
1. **Single file focus** per prompt
2. **Clear success criteria** defined
3. **Explicit preservation requirements** listed
4. **Integration points** specified

### **Phase 3: Post-Bolt Verification**
1. **Test existing functionality** unchanged
2. **Verify performance targets** met
3. **Check file sizes** within limits
4. **Validate mobile compatibility**

## 📊 **EFFECTIVE BOLT REQUESTS FOR aVOID**

### **Current Priority Tasks with Bolt-Ready Prompts:**

#### **1. Engine.ts Refactoring (723 lines → modules)**
```
OBJECTIVE: Split Engine.ts into GameEngine.ts module

EXTRACT RESPONSIBILITIES:
- Core game loop and timing
- Game state management (play/pause/reset)
- Basic physics coordination

TARGET: 180-200 lines

PRESERVE:
- All existing game mechanics
- Current performance optimizations
- Existing API for components

EXCLUDE FROM THIS MODULE:
- Input handling (separate module)
- Rendering (already separated)
- Settings management (separate module)
```

#### **2. Mobile Touch Enhancement**
```
OBJECTIVE: Enhance touch controls for continuous finger tracking

CURRENT STATE:
- File: src/game/Engine.ts (input handling section)
- Has basic touch start/end
- Missing continuous movement

ADD:
- Continuous touch movement tracking
- Multi-touch prevention
- Touch position smoothing

PRESERVE:
- All existing mouse controls
- Current knockback power activation
- Performance optimizations

MOBILE REQUIREMENTS:
- Prevent page scrolling during play
- 60fps touch response
- Works on all screen sizes
```

#### **3. Mobile UI Optimization**
```
OBJECTIVE: Hide gameplay buttons on mobile devices

TARGET: src/components/HUD.tsx

CHANGES:
- Hide debug/settings buttons during gameplay on mobile
- Keep buttons in game over screen
- Add mobile detection logic

PRESERVE:
- All desktop functionality
- Current responsive design
- Existing component structure

RESPONSIVE STRATEGY:
- Breakpoint: 768px width
- Touch device detection
- Graceful degradation
```

## 🎯 **BOLT SUCCESS METRICS**

### **Quality Indicators:**
- ✅ **File size <500 lines**
- ✅ **No functionality regression**
- ✅ **Performance maintained/improved**
- ✅ **Mobile compatibility enhanced**
- ✅ **Clean separation of concerns**

### **Red Flags (Avoid These Prompts):**
- ❌ "Rewrite the entire game engine"
- ❌ "Fix all performance issues at once"
- ❌ "Add mobile support everywhere"
- ❌ "Optimize everything"
- ❌ Vague requirements without constraints

## 🚀 **BOLT ITERATION STRATEGY**

### **Incremental Enhancement Pattern:**
1. **Start small** (single component/function)
2. **Test thoroughly** before next change
3. **Build upon success** incrementally
4. **Maintain working state** at each step

### **Rollback Strategy:**
- Always work on **feature branches**
- **Test before merging** to main
- **Document changes** for easy rollback
- **Keep working backups** of complex files

---

## 💡 **QUICK REFERENCE: BOLT COMMAND PHRASES**

### **DO Use These Phrases:**
- "Enhance the existing [specific component]"
- "Add [specific feature] to current [system]"
- "Optimize [specific function] for [specific goal]"
- "Modify [exact file] to include [specific change]"
- "Preserve all existing [functionality/API/performance]"

### **DON'T Use These Phrases:**
- "Create a new [something that exists]"
- "Fix everything"
- "Optimize the whole project"
- "Make it work better"
- "Add all mobile features"

**This framework should give you the systematic approach you need to work effectively with Bolt while maintaining code quality and performance!** 