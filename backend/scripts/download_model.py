import os
import sys
from pathlib import Path
from huggingface_hub import hf_hub_download

def download_model():
    """
    Downloads the Phi-3-mini-4k-instruct-q4 model from Hugging Face.
    Saves it to backend/models/phi3-mini.gguf.
    """
    repo_id = "microsoft/Phi-3-mini-4k-instruct-gguf"
    filename = "Phi-3-mini-4k-instruct-q4.gguf"
    
    # Define models directory (backend/models)
    models_dir = Path(__file__).resolve().parents[1] / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    
    target_path = models_dir / "phi3-mini.gguf"
    
    print("="*60)
    print(f"Checking for Local LLM Model: {target_path}")
    print("="*60)
    
    if target_path.exists():
        size_gb = target_path.stat().st_size / (1024**3)
        if size_gb > 1.0: # Expecting around ~2.3GB
            print(f"Model already exists on disk! Size: {size_gb:.2f} GB")
            return target_path
        else:
            print(f"Model file exists but is suspiciously small ({size_gb:.2f} GB). Re-downloading...")
            target_path.unlink()
            
    print(f"Downloading {filename} from {repo_id}...")
    print("This is a ~2.3GB file. It may take several minutes depending on your network connection.")
    print("Please wait...")
    
    try:
        # Download the file to cache, then symlink/copy it to our local directory
        downloaded_path = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=str(models_dir),
            local_dir_use_symlinks=False
        )
        
        # Rename it to our target name
        os.rename(downloaded_path, target_path)
        
        size_gb = target_path.stat().st_size / (1024**3)
        print(f"\n[SUCCESS] Model downloaded successfully!")
        print(f"Saved to: {target_path}")
        print(f"Final Size: {size_gb:.2f} GB")
        return target_path
    except Exception as e:
        print(f"\n[ERROR] Failed to download model: {e}")
        print("Please check your internet connection or run this script manually later.")
        sys.exit(1)

if __name__ == "__main__":
    download_model()
