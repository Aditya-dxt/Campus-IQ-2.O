import os
from pathlib import Path
from kaggle.api.kaggle_api_extended import KaggleApi

def download_dataset():
    """Download the Resume Dataset from Kaggle."""
    dataset_name = "snehannbhawal/resume-dataset"
    download_dir = Path(__file__).parent / "dataset"
    
    download_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Authenticating with Kaggle to download {dataset_name}...")
    api = KaggleApi()
    
    try:
        api.authenticate()
    except Exception as e:
        print("\nERROR: Could not authenticate with Kaggle.")
        print("Please ensure your kaggle.json file is placed in C:\\Users\\adity\\.kaggle\\kaggle.json")
        print(f"Original error: {e}")
        return False
        
    print(f"Downloading dataset to {download_dir}...")
    api.dataset_download_files(dataset_name, path=str(download_dir), unzip=True)
    print("Download and extraction complete!")
    return True

if __name__ == "__main__":
    download_dataset()
