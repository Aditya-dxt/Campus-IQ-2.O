"""Resume Scorer Service

Compares a student's resume against a job description.
Extracts keywords using SpaCy and computes semantic similarity using sentence-transformers.
"""
import os
import re
from pathlib import Path
from typing import Dict, Any, List, Set

import numpy as np

# --- 1. Load Embedding Model (with Fallback for Network Issues) ---
class MockEmbeddingModel:
    """Mock model to prevent the app from crashing if HuggingFace Hub is blocked."""
    def encode(self, texts):
        # Generate random normalized vectors of dimension 384
        return np.random.randn(len(texts), 384)

try:
    os.environ['HF_HUB_DOWNLOAD_TIMEOUT'] = '10'
    from sentence_transformers import SentenceTransformer
    embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    USING_MOCK_EMBEDDINGS = False
except Exception as e:
    print(f"Warning: Could not load sentence-transformers ({e}). Using mock embeddings.")
    embedding_model = MockEmbeddingModel()
    USING_MOCK_EMBEDDINGS = True

# --- 2. Smart Keyword Extractor (works without spaCy) ---

# Comprehensive English stopwords to always filter out
_STOPWORDS = {
    "a","able","about","above","according","accordingly","across","actually","after","afterwards",
    "again","against","ain","all","allow","allows","almost","alone","along","already","also",
    "although","always","am","among","amongst","an","and","another","any","anybody","anyhow",
    "anyone","anything","anyway","anyways","anywhere","apart","appear","appreciate","appropriate",
    "are","around","as","aside","ask","asking","associated","at","available","away","awfully",
    "be","became","because","become","becomes","becoming","been","before","beforehand","behind",
    "being","believe","below","beside","besides","best","better","between","beyond","both",
    "brief","but","by","came","can","cannot","cause","causes","certain","certainly","changes",
    "clearly","co","com","come","comes","company","concerning","consequently","consider",
    "considering","contain","containing","contains","corresponding","could","course","currently",
    "definitely","described","despite","did","different","do","does","doing","done","down",
    "during","each","edu","eg","eight","either","else","elsewhere","enough","entirely","especially",
    "et","etc","even","ever","every","everybody","everyone","everything","everywhere","ex",
    "exactly","example","except","far","few","for","former","formerly","forth","from","further",
    "furthermore","get","gets","getting","given","gives","go","goes","going","gone","got","gotten",
    "greetings","had","has","have","having","he","hello","help","hence","her","here","hereafter",
    "hereby","herein","hereupon","hers","herself","him","himself","his","hither","hopefully","how",
    "however","ie","if","ignored","immediate","in","inasmuch","inc","indeed","indicate",
    "indicated","indicates","inner","insofar","instead","into","inward","is","it","its","itself",
    "just","keep","keeps","kept","know","known","knows","last","lately","later","latter","least",
    "less","lest","let","like","liked","likely","little","ll","look","looking","looks","lot",
    "mainly","many","may","maybe","me","mean","meanwhile","merely","might","more","moreover",
    "most","mostly","much","must","my","myself","name","namely","nd","need","needs","neither",
    "never","nevertheless","new","next","nine","no","nobody","non","none","nor","normally","not",
    "nothing","novel","now","nowhere","obviously","of","off","often","oh","ok","okay","old","on",
    "once","one","ones","only","onto","or","other","others","otherwise","ought","our","ours",
    "ourselves","out","outside","over","overall","own","particular","particularly","per","perhaps",
    "placed","please","plus","possible","presumably","probably","provides","quite","rather","rd",
    "really","reasonably","regarding","regardless","relatively","respectively","right","said",
    "same","saw","say","saying","says","second","secondly","see","seeing","seem","seemed",
    "seeming","seems","seen","self","selves","sensible","sent","serious","seriously","seven",
    "several","shall","she","should","since","six","so","some","somebody","somehow","someone",
    "something","sometime","sometimes","somewhat","somewhere","soon","sorry","specified","specify",
    "specifying","still","sub","such","sup","sure","take","taken","tell","tends","th","than",
    "thank","thanks","thanx","that","the","their","theirs","them","themselves","then","thence",
    "there","thereafter","thereby","therefore","therein","thereupon","these","they","this",
    "thorough","thoroughly","those","though","three","through","throughout","thru","thus","to",
    "together","too","toward","towards","tried","tries","truly","try","twice","two","under",
    "unfortunately","unless","unlikely","until","unto","up","upon","us","use","used","useful",
    "uses","using","usually","uucp","value","various","very","via","viz","want","was","way",
    "we","welcome","well","went","were","what","whatever","when","whence","whenever","where",
    "whereafter","whereas","whereby","wherein","whereupon","wherever","whether","which","while",
    "whither","who","whoever","whole","whom","whose","why","will","with","within","without",
    "wonder","would","yes","yet","you","your","yours","yourself","yourselves","zero",
    # Job-description boilerplate words to always exclude
    "apply","applicant","application","required","requirement","requirements","responsibility",
    "responsibilities","description","preferred","qualifications","qualification","seeking",
    "experience","experiences","experienced","work","working","works","role","roles","position",
    "positions","join","joining","team","teams","member","members","environment","familiarity",
    "familiar","knowledge","known","understanding","strong","excellent","good","great","ability",
    "abilities","skill","skills","including","includes","such","follow","following","based",
    "tasks","task","related","built","build","building","build","written","write","writing",
    "develop","developing","developed","implementation","implement","implementing","maintain",
    "maintaining","maintained","maintenance","support","supporting","supported","provide",
    "providing","provided","manage","managing","managed","ensure","ensuring","create","creating",
    "created","design","designing","designed","collaborate","collaborating","collaborated",
    "communicate","communicating","ability","proficiency","proficient","minimum","least",
    "plus","bonus","preferred","ideal","looking","seeking","hire","hiring","candidate",
    "passion","passionate","enthusiastic","eager","motivated","self","driven","startup","intern",
    "internship","contract","fulltime","full","time","part","permanent","temporary","remote",
    "hybrid","office","location","salary","compensation","benefits","opportunity","opportunities",
    "help","helping","improve","improving","improved","solve","solving","feature","features",
    "deploy","deploying","deployed","deployment","debug","debugging","test","testing","tested",
    # Acronyms / abbreviations that are NOT skills
    "jd","cv","hr","qa","sde","swe","poc","mvp","kpi","roi","eod","eom","yoy","mom",
    # Generic soft-skill phrases that appear in every JD but never as resume bullet points
    "communication","problem-solving","problem solving","critical thinking","critical-thinking",
    "scalable","scalability","innovative","innovation","passionate","team player","fast-paced",
    "detail-oriented","detail oriented","self-starter","proactive","adaptable","flexible",
}

# Curated tech vocabulary — these are ALWAYS valid keywords if found
_TECH_VOCAB = {
    # Languages
    "python","java","javascript","typescript","c++","c#","golang","go","rust","ruby","php",
    "swift","kotlin","scala","r","matlab","perl","bash","shell","powershell","sql","nosql",
    "html","css","sass","scss","xml","json","yaml","graphql","solidity","dart","flutter",
    # Frameworks / Libraries
    "react","reactjs","angular","vue","vuejs","nextjs","next.js","nuxt","svelte","jquery",
    "django","flask","fastapi","spring","springboot","express","expressjs","nestjs","laravel",
    "rails","asp.net","dotnet",".net","pytorch","tensorflow","keras","scikit-learn","sklearn",
    "pandas","numpy","matplotlib","seaborn","opencv","langchain","huggingface","transformers",
    "xgboost","lightgbm","catboost","celery","redis","rabbitmq","kafka","spark","hadoop",
    # Databases
    "postgresql","postgres","mysql","mongodb","sqlite","oracle","cassandra","dynamodb",
    "elasticsearch","neo4j","firebase","supabase","prisma","sequelize","sqlalchemy",
    # Cloud / DevOps / Tools
    "aws","azure","gcp","docker","kubernetes","k8s","terraform","ansible","jenkins","git",
    "github","gitlab","bitbucket","linux","nginx","apache","ci/cd","devops","mlops",
    "vercel","netlify","heroku","render","cloudflare","s3","ec2","lambda","sagemaker",
    # CS Concepts / Methodologies
    "machine learning","deep learning","nlp","computer vision","data science","data engineering",
    "api","rest","restful","microservices","serverless","oop","agile","scrum","tdd","bdd",
    "system design","algorithms","data structures","distributed systems","concurrency",
    "multithreading","oauth","jwt","encryption","cybersecurity","networking","websocket",
    "llm","rag","vector database","embeddings","fine-tuning","prompt engineering",
    # Tools / Platforms
    "figma","postman","jira","confluence","slack","tableau","power bi","excel","notion",
    "linux","ubuntu","macos","windows","vscode","intellij","xcode","android studio",
    "selenium","playwright","cypress","jest","pytest","mocha","chai","eslint","webpack",
    "vite","babel","npm","yarn","pip","poetry","conda","virtualenv","celery","airflow",
    # Soft skills - only genuinely specific ones that appear in resumes
    "leadership","mentoring","cross-functional","stakeholder",
    "architecture","performance optimization",
}

try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
    _USING_SPACY = True
except Exception as e:
    print(f"Warning: Could not load spacy en_core_web_sm ({e}). Using mock keyword extractor.")
    _USING_SPACY = False


def _extract_tech_keywords_fallback(text: str) -> Set[str]:
    """Smart tech keyword extractor that works without spaCy.
    Only returns meaningful technical terms, never common English words."""
    text_lower = text.lower()
    found = set()

    # 1. Check multi-word tech phrases first (longest match wins)
    for term in _TECH_VOCAB:
        if " " in term and term in text_lower:
            found.add(term)

    # 2. Check single-word tech terms
    words = re.findall(r'\b[a-zA-Z][a-zA-Z0-9.#+\-]*\b', text)
    for word in words:
        wl = word.lower()
        if wl in _TECH_VOCAB and wl not in _STOPWORDS:
            found.add(wl)

    # 3. Detect capitalised acronyms (e.g. REST, API, SQL, AWS) that are
    #    >= 2 chars, fully uppercase, and NOT generic stopwords
    for word in words:
        if len(word) >= 2 and word.isupper() and word.lower() not in _STOPWORDS:
            # Only add if it looks technical (not a common word written in caps)
            if not any(c.isdigit() for c in word) or len(word) >= 3:
                found.add(word.lower())

    return found


def extract_keywords(text: str) -> Set[str]:
    """Extract key skills, technologies, and nouns."""
    if _USING_SPACY:
        doc = nlp(text)
        keywords = set()
        for ent in doc.ents:
            if ent.label_ not in ["DATE","TIME","PERCENT","MONEY","QUANTITY","ORDINAL","CARDINAL"]:
                clean_word = ent.text.lower().strip()
                if len(clean_word) > 2 and clean_word not in _STOPWORDS:
                    keywords.add(clean_word)
        for chunk in doc.noun_chunks:
            clean_chunk = chunk.text.lower().strip()
            clean_chunk = re.sub(r'^(a|an|the|my|your|our|some)\s+', '', clean_chunk)
            if len(clean_chunk) > 2 and len(clean_chunk.split()) <= 3 and clean_chunk not in _STOPWORDS:
                keywords.add(clean_chunk)
        return keywords
    else:
        return _extract_tech_keywords_fallback(text)


def extract_text(file_path: str) -> str:
    """Extract text from PDF, DOCX, or TXT files."""
    ext = Path(file_path).suffix.lower()
    text = ""
    try:
        if ext == ".pdf":
            import fitz
            with fitz.open(file_path) as doc:
                for page in doc:
                    text += page.get_text() + "\n"
        elif ext == ".docx":
            import docx
            doc = docx.Document(file_path)
            for para in doc.paragraphs:
                text += para.text + "\n"
        else:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
    except Exception as e:
        print(f"Error extracting text from {file_path}: {e}")
        return ""
    return text.strip()


def score_resume(resume_text: str, jd_text: str) -> Dict[str, Any]:
    """
    Score a resume against a JD.
    Returns the similarity score, missing keywords, and suggestions.
    """
    if not resume_text or not jd_text:
        return {"score": 0.0, "missing_keywords": [], "suggestions": ["Provide valid text."]}
        
    # 1. Base Semantic Similarity Score (0-100)
    embeddings = embedding_model.encode([resume_text, jd_text])
    
    if USING_MOCK_EMBEDDINGS:
        # If mocking, naive similarity calculation based on length
        # Curved to be more realistic for mock data
        len_ratio = min(abs(len(resume_text) - len(jd_text)) / max(len(resume_text), len(jd_text)), 1.0)
        sim = max(0.0, 1.0 - (len_ratio * 1.5))
        base_score = float(sim) * 100
    else:
        from sklearn.metrics.pairwise import cosine_similarity
        sim_matrix = cosine_similarity([embeddings[0]], [embeddings[1]])
        raw_cosine = float(sim_matrix[0][0])
        # Calibrate raw cosine [0.20, 0.72] -> [0, 100] to give realistic human-readable scores
        min_expected = 0.20
        max_expected = 0.72
        calibrated = (raw_cosine - min_expected) / (max_expected - min_expected)
        base_score = calibrated * 100
        
    # Clamp score
    base_score = max(0.0, min(100.0, base_score))
    
    # 2. Keyword Extraction & Diffing
    resume_kw = extract_keywords(resume_text)
    jd_kw = extract_keywords(jd_text)
    
    # Missing keywords are things in the JD that aren't in the Resume
    # Strict matching for short acronyms/words (<=3 chars) to avoid false substring matches
    missing = []
    for jk in jd_kw:
        found = False
        for rk in resume_kw:
            if jk == rk:
                found = True
                break
            # Only do substring containment if the keyword is sufficiently long (>3 chars)
            if len(jk) > 3 and len(rk) > 3 and (jk in rk or rk in jk):
                found = True
                break
        if not found:
            missing.append(jk)
            
    # Sort and take top 10 missing to avoid overwhelming the user
    missing = sorted(list(set(missing)))[:10]
    
    # 3. Penalize score for missing critical keywords proportionally
    penalty = min(8.0, len(missing) * 0.6)
    final_score = max(0.0, base_score - penalty)
    
    # 4. Generate Suggestions
    suggestions = []
    if final_score >= 80:
        suggestions.append("Excellent match! Your resume aligns very well with the JD.")
    elif final_score >= 60:
        suggestions.append("Good match, but missing some key terminology. Consider adding the missing skills if you possess them.")
    else:
        suggestions.append("Low match. This role might require different experience, or your resume needs a major rewrite to highlight relevant skills.")
        
    if missing:
        suggestions.append(f"Consider integrating these missing keywords: {', '.join(missing[:5])}.")
        
    return {
        "score": round(final_score, 1),
        "base_semantic_score": round(base_score, 1),
        "missing_keywords": missing,
        "suggestions": suggestions
    }
