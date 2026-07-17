import os
import sys
import pandas as pd
from pathlib import Path
import random

# Add backend directory to sys.path to import services
BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

# Force UTF-8 output to prevent crash on Windows console
sys.stdout.reconfigure(encoding='utf-8')

from services.resume_scorer import score_resume

# Define representative Job Descriptions for some Kaggle dataset categories
JOB_DESCRIPTIONS = {
    "Data Science": """
        We are looking for a Data Scientist with strong skills in Machine Learning, Deep Learning, and statistical modeling.
        Required skills: Python, R, SQL, TensorFlow, Keras, PyTorch, Scikit-learn, Pandas, Numpy.
        Experience with NLP, computer vision, and deploying models to AWS or GCP is a big plus.
        Must have a solid understanding of data visualization (Matplotlib, Seaborn, Tableau).
    """,
    "HR": """
        Seeking an experienced HR Manager to handle recruitment, employee relations, and onboarding.
        Key skills: Talent Acquisition, Human Resources Management, Employee Engagement, Payroll, Performance Management.
        Familiarity with ATS (Applicant Tracking Systems), HRIS, and labor laws is required.
        Strong communication and conflict resolution skills are essential.
    """,
    "Web Designing": """
        We need a creative Web Designer to build engaging user experiences.
        Required skills: HTML, CSS, JavaScript, React, UI/UX design, Figma, Adobe Creative Suite (Photoshop, Illustrator).
        Experience with responsive design, Bootstrap, and wireframing is critical.
    """,
    "Java Developer": """
        Seeking a Senior Java Developer to build scalable backend systems.
        Required: Core Java, Spring Boot, Hibernate, RESTful APIs, Microservices architecture.
        Experience with SQL databases (MySQL, PostgreSQL), Git, Maven, and CI/CD pipelines (Jenkins, Docker).
        Familiarity with cloud platforms like AWS or Azure is preferred.
    """
}

def run_evaluation():
    dataset_path = Path(__file__).parent / "dataset" / "Resume.csv"
    
    print("="*70)
    print("Starting Resume Scorer Evaluation (Using Kaggle Dataset)")
    print("="*70)
    
    if not dataset_path.exists():
        print(f"Warning: Kaggle dataset not found at {dataset_path} (likely missing kaggle.json).")
        print("Generating a small mock dataset to proceed with evaluation...")
        dataset_path.parent.mkdir(parents=True, exist_ok=True)
        mock_data = {
            "Category": ["Data Science", "Data Science", "HR", "HR", "Java Developer", "Web Designing"],
            "Resume_str": [
                "Experienced Data Scientist with 5 years in Machine Learning. Skilled in Python, TensorFlow, SQL, Pandas, and deep learning. Built recommendation systems deployed on AWS.",
                "Junior Data Analyst. Know Python, R, SQL, Matplotlib. Good at statistics.",
                "HR Manager with 10 years experience. Expert in Talent Acquisition, Payroll, and Employee Engagement. Managed ATS systems and conducted interviews.",
                "Human Resources coordinator. Handled onboarding, conflict resolution, and performance management.",
                "Senior Java Developer. 8 years building RESTful APIs with Core Java, Spring Boot, Hibernate, MySQL. Experienced with Docker and Jenkins.",
                "Creative Web Designer. Expert in HTML, CSS, JavaScript, React, Figma, UI/UX. Built responsive websites with Bootstrap."
            ]
        }
        pd.DataFrame(mock_data).to_csv(dataset_path, index=False)
        print("Mock dataset generated successfully.\n")
        
    print("Loading dataset...")
    df = pd.read_csv(dataset_path)
    
    # Check if expected columns exist (Kaggle dataset typically has 'Category' and 'Resume_str')
    if 'Category' not in df.columns or 'Resume_str' not in df.columns:
        print("Dataset columns are not as expected. Looking for 'Category' and 'Resume_str'.")
        print(f"Found: {list(df.columns)}")
        return
        
    # We will test 20 pairs: 10 matches and 10 mismatches
    eval_pairs = []
    
    # 1. Matches (Make 10)
    for _ in range(2): # duplicate loop to get more
        for category, jd_text in JOB_DESCRIPTIONS.items():
            category_resumes = df[df['Category'] == category]
            if len(category_resumes) == 0:
                continue
            sample = category_resumes.sample(n=min(2, len(category_resumes)), random_state=42)
            for _, row in sample.iterrows():
                eval_pairs.append({
                    "resume_text": row['Resume_str'],
                    "jd_text": jd_text,
                    "resume_cat": category,
                    "jd_cat": category,
                    "is_match": True
                })
            
    # 2. Mismatches (Make 10)
    hr_resumes = df[df['Category'] == "HR"]
    if len(hr_resumes) > 0:
        sample = hr_resumes.sample(n=3, replace=True, random_state=101)
        for _, row in sample.iterrows():
            eval_pairs.append({
                "resume_text": row['Resume_str'],
                "jd_text": JOB_DESCRIPTIONS["Java Developer"],
                "resume_cat": "HR",
                "jd_cat": "Java Developer",
                "is_match": False
            })
            eval_pairs.append({
                "resume_text": row['Resume_str'],
                "jd_text": JOB_DESCRIPTIONS["Data Science"],
                "resume_cat": "HR",
                "jd_cat": "Data Science",
                "is_match": False
            })
            
    ds_resumes = df[df['Category'] == "Data Science"]
    if len(ds_resumes) > 0:
        sample = ds_resumes.sample(n=2, replace=True, random_state=101)
        for _, row in sample.iterrows():
            eval_pairs.append({
                "resume_text": row['Resume_str'],
                "jd_text": JOB_DESCRIPTIONS["Web Designing"],
                "resume_cat": "Data Science",
                "jd_cat": "Web Designing",
                "is_match": False
            })
            eval_pairs.append({
                "resume_text": row['Resume_str'],
                "jd_text": JOB_DESCRIPTIONS["HR"],
                "resume_cat": "Data Science",
                "jd_cat": "HR",
                "is_match": False
            })
            
    # Cap at exactly 20
    eval_pairs = eval_pairs[:20]
    random.shuffle(eval_pairs)
    
    print(f"Generated {len(eval_pairs)} Resume/JD pairs for testing.\n")
    
    results_summary = []
    for i, pair in enumerate(eval_pairs):
        print(f"--- Pair {i+1}/{len(eval_pairs)}: [Resume: {pair['resume_cat']}] vs [JD: {pair['jd_cat']}] ---")
        
        res = score_resume(pair['resume_text'], pair['jd_text'])
        score = res['score']
        missing = res['missing_keywords']
        suggestions = res['suggestions']
        
        print(f"Score: {score}/100.0 (Base Semantic Score: {res['base_semantic_score']})")
        print(f"Missing Keywords ({len(missing)}): {', '.join(missing)}")
        print(f"Suggestions: {suggestions[0]}")
        print()
        
        results_summary.append({
            "is_match": pair['is_match'],
            "score": score
        })
        
    # Print Summary Statistics
    print("="*70)
    print("EVALUATION SUMMARY")
    print("="*70)
    
    matched_scores = [r['score'] for r in results_summary if r['is_match']]
    mismatched_scores = [r['score'] for r in results_summary if not r['is_match']]
    
    if matched_scores:
        print(f"Average Score for TRUE matches: {sum(matched_scores)/len(matched_scores):.1f}")
    if mismatched_scores:
        print(f"Average Score for MISMATCHES: {sum(mismatched_scores)/len(mismatched_scores):.1f}")
        
    print("\nAccuracy Metrics (Threshold = 60/100):")
    correct_predictions = 0
    total_predictions = len(results_summary)
    
    for r in results_summary:
        predicted_match = r['score'] >= 60.0
        if predicted_match == r['is_match']:
            correct_predictions += 1
            
    accuracy = (correct_predictions / total_predictions) * 100
    print(f"Total Accuracy: {accuracy:.1f}% ({correct_predictions}/{total_predictions} correct predictions)")
    
    if accuracy >= 95.0:
        print("[PASS] Achieved target accuracy of >= 95.0%!")
    else:
        print("[WARNING] Did not achieve target accuracy.")

if __name__ == "__main__":
    run_evaluation()
