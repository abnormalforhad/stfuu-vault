import os
import random
import subprocess
import time

# --- CONFIGURATION ---
TOTAL_COMMITS = 50       # How many green squares for today?
FILENAME = "farming_activity.txt" # Changed to .txt to avoid gitignore errors
# ---------------------

def run_git(command):
    # We use capture_output to hide messy logs, but check=True to catch errors
    subprocess.run(command, shell=True, check=True)

def main():
    print(f"--- 🕵️‍♂️ Starting Stealth Farmer ({TOTAL_COMMITS} commits) ---")
    
    # 1. Create/Update the dummy file
    if not os.path.exists(FILENAME):
        with open(FILENAME, "w") as f:
            f.write("Farming Log Started.\n")

    # 2. Loop through the commits
    for i in range(TOTAL_COMMITS):
        try:
            # A. Make a tiny change
            with open(FILENAME, "a") as f:
                f.write(f"Commit {i+1} - {random.randint(1000, 9999)}\n")
            
            # B. FORCE ADD the file (Fixes your error!)
            run_git(f"git add -f {FILENAME}")
            
            # C. Commit
            msgs = ["wip", "update", "save", "fix", "progress"]
            msg = random.choice(msgs)
            run_git(f'git commit -m "{msg} {i+1}"')
            
            print(f"   ✅ Committed {i+1}/{TOTAL_COMMITS}")
            
        except Exception as e:
            print(f"   ❌ Error on commit {i+1}: {e}")
            break

    # 3. Push everything
    print("\n--- 🚀 Uploading to GitHub... ---")
    try:
        run_git("git push")
        print("✅ REAL SUCCESS! Check your profile now.")
    except Exception as e:
        print(f"❌ Push failed: {e}")

if __name__ == "__main__":
    main()