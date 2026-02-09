import os
import shutil
import subprocess
import time

# --- CONFIGURATION ---
# Your repository URL (I copied this from your previous message)
REPO_URL = "https://github.com/abnormalforhad/stfuu-vault.git"
# ---------------------

def run_command(cmd):
    print(f"👉 Running: {cmd}")
    try:
        subprocess.run(cmd, shell=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Error: {e}")
        exit(1)

def main():
    print("--- ☢️ STARTING REPO NUKE ☢️ ---")
    
    # 1. FORCE DELETE the hidden .git folder
    if os.path.exists(".git"):
        print("1. Found old .git folder. Destroying it...")
        # This python command is stronger than the terminal command
        try:
            # We use a system command to force delete hidden files on Windows
            os.system('rmdir /S /Q .git') 
        except:
            pass
        
        # Double check with python
        shutil.rmtree(".git", ignore_errors=True)
        time.sleep(1) # Wait for Windows to release the files
        
        if os.path.exists(".git"):
            print("❌ FAILED to delete .git. Close all other programs and try again.")
            return
        else:
            print("✅ Old history deleted successfully.")
    else:
        print("1. No .git folder found. Clean start.")

    # 2. Re-initialize everything
    print("\n2. Creating new history...")
    run_command("git init")
    
    # 3. Add files
    print("\n3. Adding files (This makes YOU the owner)...")
    run_command("git add .")
    
    # 4. Commit
    print("\n4. Committing...")
    run_command('git commit -m "Initial commit"')
    
    # 5. Rename branch
    print("\n5. Renaming branch...")
    run_command("git branch -M main")
    
    # 6. Link to GitHub
    print("\n6. Linking to GitHub...")
    run_command(f"git remote add origin {REPO_URL}")
    
    # 7. Force Push
    print("\n7. FORCE PUSHING TO GITHUB...")
    run_command("git push -u -f origin main")
    
    print("\n🎉 DONE! Sukanto should be gone from the code history.")
    print("⚠️ NOTE: The 'Contributors' list on the right side of GitHub might take 24 hours to update.")
    print("👉 Click 'Commits' on GitHub to verify you see only 1 commit.")

if __name__ == "__main__":
    main()