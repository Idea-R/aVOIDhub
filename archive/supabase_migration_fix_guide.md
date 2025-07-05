# Supabase Migration Fix Guide - current_time Reserved Keyword Issue

## 🚨 **PROBLEM IDENTIFIED**

### **Root Cause:**
- `current_time` is a **PostgreSQL reserved keyword**
- Your migrations had **backwards logic** in the existence checks
- **Syntax Error**: `ERROR: 42601: syntax error at or near "current_time"`

### **The Logic Error in Your Migrations:**
```sql
-- WRONG (your current migrations):
IF EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'user_profiles' AND column_name = 'current_survival_time'
) THEN
  ALTER TABLE user_profiles RENAME COLUMN current_time TO current_survival_time;
```

**Why this fails:**
- You check if `current_survival_time` exists
- But then try to rename `current_time` → `current_survival_time`
- This creates a logic contradiction!

## 🔧 **SOLUTION METHODS**

### **Method 1: Apply the Corrected Migration (RECOMMENDED)**

I've created a corrected migration file: `supabase/migrations/20250607070000_fix_current_time_issue.sql`

**Steps to apply:**
1. **Copy the corrected migration** to your Supabase dashboard
2. **Run the migration** through the Supabase SQL editor
3. **Verify the fix** by checking the schema

### **Method 2: Manual Supabase Dashboard Fix**

**Go to your Supabase Dashboard:**

1. **Navigate to:** `Project Settings` → `Database` → `Extensions`
2. **Go to:** `SQL Editor`
3. **Run this corrected SQL:**

```sql
-- Step 1: Check current table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_profiles';

-- Step 2: Fix the column rename (CORRECTED LOGIC)
DO $$
BEGIN
  -- Check if the problematic 'current_time' column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'current_time'
  ) THEN
    -- Rename the problematic column
    ALTER TABLE user_profiles RENAME COLUMN current_time TO current_survival_time;
    RAISE NOTICE 'SUCCESS: Renamed current_time to current_survival_time';
  ELSE
    RAISE NOTICE 'INFO: current_time column does not exist, no rename needed';
  END IF;
END $$;

-- Step 3: Ensure the column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'current_survival_time'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN current_survival_time NUMERIC DEFAULT 0;
    RAISE NOTICE 'SUCCESS: Added current_survival_time column';
  ELSE
    RAISE NOTICE 'INFO: current_survival_time column already exists';
  END IF;
END $$;
```

### **Method 3: Reset and Rebuild (NUCLEAR OPTION)**

**If migrations are completely broken:**

1. **Backup your data** first!
2. **Go to Supabase Dashboard** → `Settings` → `General`
3. **Reset Database** (⚠️ **DESTROYS ALL DATA** ⚠️)
4. **Run clean migrations** without reserved keywords

## 🛠️ **VERIFICATION STEPS**

### **1. Check Table Structure**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;
```

**Expected columns:**
- ✅ `current_survival_time` (NUMERIC)
- ❌ `current_time` (should NOT exist)

### **2. Test Function**
```sql
-- Test the function works
SELECT update_game_statistics(
  'your-user-id'::UUID,
  1, -- games_increment
  5, -- meteors_increment  
  30.5, -- survival_increment
  100.0, -- distance_increment
  1000, -- current_score
  5, -- current_meteors
  30.5, -- current_survival_time
  100.0 -- current_distance
);
```

### **3. Verify No Reserved Keywords**
```sql
-- Check for any remaining reserved keyword issues
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name IN ('current_time', 'user', 'order', 'group', 'table');
```

## 📋 **PREVENTION STRATEGIES**

### **Reserved Keywords to Avoid:**
- `current_time` ❌
- `current_date` ❌
- `current_timestamp` ❌
- `user` ❌
- `order` ❌
- `group` ❌
- `table` ❌

### **Safe Alternatives:**
- `current_survival_time` ✅
- `game_time` ✅
- `survival_duration` ✅
- `user_id` ✅
- `sort_order` ✅

## 🚀 **NEXT STEPS**

### **Immediate Actions:**
1. **Apply the corrected migration** (Method 1 or 2)
2. **Test the function** works correctly
3. **Verify no reserved keywords** remain

### **Code Updates Needed:**
1. **Update your TypeScript code** to use `current_survival_time`
2. **Check API calls** in `src/api/profiles.ts`
3. **Update form handling** in components

### **Testing Checklist:**
- ✅ Profile creation works
- ✅ Game statistics update correctly
- ✅ Leaderboard displays properly
- ✅ No SQL errors in browser console

## 🔍 **TROUBLESHOOTING**

### **If you still get errors:**

**Error: "relation does not exist"**
- Table wasn't created properly
- Run the table creation migration first

**Error: "function does not exist"**
- Function wasn't created
- Rerun the function creation part

**Error: "permission denied"**
- Authentication issue
- Check RLS policies and grants

### **Emergency Rollback:**
```sql
-- If you need to rollback the column rename
ALTER TABLE user_profiles RENAME COLUMN current_survival_time TO current_time;
```

## 📊 **MIGRATION STATUS TRACKING**

### **Before Fix:**
- ❌ Migration errors with `current_time`
- ❌ Function creation failures
- ❌ API calls breaking

### **After Fix:**
- ✅ All migrations run successfully
- ✅ Function works correctly
- ✅ API calls functioning
- ✅ No reserved keyword conflicts

**Use this guide to systematically resolve your Supabase migration issues!** 