"""Local LLM Service

Provides an interface to a local offline LLM (Phi-3-mini) using llama-cpp-python.
Loads the model into memory once at startup.
"""
import os
from pathlib import Path

# The model will be loaded once at module import time (singleton)
llm = None
MODEL_LOADED = False

def init_llm():
    global llm, MODEL_LOADED
    if MODEL_LOADED:
        return
        
    models_dir = Path(__file__).resolve().parents[1] / "models"
    model_path = models_dir / "phi3-mini.gguf"
    
    if not model_path.exists():
        print(f"Warning: Model not found at {model_path}. Run backend/scripts/download_model.py first.")
        return
        
    try:
        from llama_cpp import Llama
        
        print("Loading local Phi-3-mini model into memory...")
        # n_ctx=4096 is standard for Phi-3-mini-4k
        llm = Llama(
            model_path=str(model_path),
            n_ctx=4096,
            n_threads=max(1, os.cpu_count() - 1),  # Leave 1 thread free for OS
            verbose=False # Keep logs clean
        )
        MODEL_LOADED = True
        print("Model loaded successfully!")
    except ImportError:
        print("Error: llama-cpp-python is not installed. Run 'pip install llama-cpp-python'.")
    except Exception as e:
        print(f"Error loading model: {e}")

def generate(prompt: str, max_tokens: int = 512) -> str:
    """
    Generate text using the local LLM.
    """
    global llm, MODEL_LOADED
    
    if not MODEL_LOADED:
        init_llm()
        
    if not MODEL_LOADED or llm is None:
        return "Error: Local LLM is not available. Please ensure the model is downloaded and llama-cpp-python is installed."
        
    try:
        output = llm(
            prompt,
            max_tokens=max_tokens,
            stop=["<|end|>", "<|user|>", "<|assistant|>"],
            echo=False
        )
        # Llama-cpp returns a dict with 'choices'
        response_text = output['choices'][0]['text'].strip()
        return response_text
    except Exception as e:
        print(f"Error during LLM generation: {e}")
        return f"Error: Generation failed."

# Attempt to initialize on module load
init_llm()
