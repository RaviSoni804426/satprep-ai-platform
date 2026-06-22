import sys
import os
import uuid

# Add the backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.models import User, StudentProfile, Topic, Question, Test, TestModule, ModuleQuestion

def seed():
    print("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    
    # Run migration queries to add new columns if they do not exist
    from sqlalchemy import text
    print("Migrating database schema for user approvals...")
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'Pending'"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by VARCHAR(36)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_notes TEXT"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_ip VARCHAR(50)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_user_agent VARCHAR(500)"))
        
        # Ensure default test users are Approved
        conn.execute(text("UPDATE users SET approval_status = 'Approved' WHERE email IN ('admin@satprepai.com', 'counsellor@satprepai.com', 'student@satprepai.com') AND (approval_status IS NULL OR approval_status = 'Pending')"))
        conn.commit()

    print("Seeding database...")
    db = SessionLocal()
    
    # 1. Create Default Users if they don't exist
    admin = db.query(User).filter(User.email == "admin@satprepai.com").first()
    if not admin:
        admin = User(
            email="admin@satprepai.com",
            password_hash=get_password_hash("AdminPass123!"),
            role="admin",
            full_name="System Administrator",
            is_verified=True,
            approval_status="Approved"
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print("Created admin user.")
        
    counsellor = db.query(User).filter(User.email == "counsellor@satprepai.com").first()
    if not counsellor:
        counsellor = User(
            email="counsellor@satprepai.com",
            password_hash=get_password_hash("CounsellorPass123!"),
            role="counsellor",
            full_name="Sarah Jenkins",
            is_verified=True,
            approval_status="Approved"
        )
        db.add(counsellor)
        db.commit()
        db.refresh(counsellor)
        print("Created counsellor user.")
        
    student = db.query(User).filter(User.email == "student@satprepai.com").first()
    if not student:
        student = User(
            email="student@satprepai.com",
            password_hash=get_password_hash("StudentPass123!"),
            role="student",
            full_name="Arjun Sharma",
            is_verified=True,
            approval_status="Approved"
        )
        db.add(student)
        db.commit()
        db.refresh(student)
        
        # Link student to counsellor
        profile = db.query(StudentProfile).filter(StudentProfile.user_id == student.id).first()
        if profile:
            profile.counsellor_id = counsellor.id
            profile.target_score = 1450
            db.commit()
        print("Created student user linked to counsellor Sarah Jenkins.")

    # 2. Create Topics
    topics_list = [
        # Reading & Writing
        {"name": "Information and Ideas", "subject": "reading", "skill_domain": "Information & Ideas"},
        {"name": "Craft and Structure", "subject": "reading", "skill_domain": "Craft & Structure"},
        {"name": "Expression of Ideas", "subject": "reading", "skill_domain": "Expression of Ideas"},
        {"name": "Standard English Conventions", "subject": "reading", "skill_domain": "Standard English Conventions"},
        # Math
        {"name": "Linear Equations and Functions", "subject": "math", "skill_domain": "Algebra"},
        {"name": "Systems of Linear Equations", "subject": "math", "skill_domain": "Algebra"},
        {"name": "Quadratic and Exponential Functions", "subject": "math", "skill_domain": "Advanced Math"},
        {"name": "Ratios, Rates, and Proportions", "subject": "math", "skill_domain": "Problem Solving & Data Analysis"},
        {"name": "Geometry and Trigonometry", "subject": "math", "skill_domain": "Geometry & Trigonometry"}
    ]
    
    topics = {}
    for t_data in topics_list:
        t = db.query(Topic).filter(Topic.name == t_data["name"]).first()
        if not t:
            t = Topic(name=t_data["name"], subject=t_data["subject"], skill_domain=t_data["skill_domain"])
            db.add(t)
            db.commit()
            db.refresh(t)
        topics[t_data["name"]] = t
        
    print(f"Verified {len(topics)} topics in database.")

    # 3. Create a Test Form
    test = db.query(Test).filter(Test.name == "Digital Mock Test #1").first()
    if not test:
        test = Test(name="Digital Mock Test #1", description="Full length Digital SAT practice test form #1", is_active=True, created_by=admin.id)
        db.add(test)
        db.commit()
        db.refresh(test)
        print("Created Test form: Digital Mock Test #1")

    # 4. Create Modules for this Test
    # Module 1: Reading (Standard, 27 questions, 32 min = 1920s)
    # Module 2A: Reading (Easy, 27 questions, 1920s)
    # Module 2B: Reading (Hard, 27 questions, 1920s)
    # Module 3: Math (Standard, 22 questions, 35 min = 2100s)
    # Module 4A: Math (Easy, 22 questions, 2100s)
    # Module 4B: Math (Hard, 22 questions, 2100s)
    
    module_configs = [
        {"module_no": 1, "subject": "reading", "difficulty": "standard", "time_limit_seconds": 1920, "question_count": 27},
        {"module_no": 2, "subject": "reading", "difficulty": "easy", "time_limit_seconds": 1920, "question_count": 27},
        {"module_no": 2, "subject": "reading", "difficulty": "hard", "time_limit_seconds": 1920, "question_count": 27},
        {"module_no": 3, "subject": "math", "difficulty": "standard", "time_limit_seconds": 2100, "question_count": 22},
        {"module_no": 4, "subject": "math", "difficulty": "easy", "time_limit_seconds": 2100, "question_count": 22},
        {"module_no": 4, "subject": "math", "difficulty": "hard", "time_limit_seconds": 2100, "question_count": 22}
    ]
    
    modules = {}
    for m_conf in module_configs:
        m = db.query(TestModule).filter(
            TestModule.test_id == test.id,
            TestModule.module_no == m_conf["module_no"],
            TestModule.difficulty == m_conf["difficulty"]
        ).first()
        if not m:
            m = TestModule(
                test_id=test.id,
                module_no=m_conf["module_no"],
                subject=m_conf["subject"],
                difficulty=m_conf["difficulty"],
                time_limit_seconds=m_conf["time_limit_seconds"],
                question_count=m_conf["question_count"]
            )
            db.add(m)
            db.commit()
            db.refresh(m)
        modules[f"{m_conf['subject']}_{m_conf['module_no']}_{m_conf['difficulty']}"] = m
        
    print("Verified test modules structure.")

    # 5. Populate Questions and associate to modules
    # Helper to generate questions in bulk
    
    def generate_and_link_questions(module_obj, count, subject, diff):
        existing_links = db.query(ModuleQuestion).filter(ModuleQuestion.module_id == module_obj.id).count()
        if existing_links >= count:
            print(f"Module {module_obj.subject} No. {module_obj.module_no} ({module_obj.difficulty}) already has {existing_links} questions.")
            return

        print(f"Generating {count} questions for module {subject} No. {module_obj.module_no} ({diff})...")
        for i in range(1, count + 1):
            if subject == "reading":
                # Create a Reading question
                topic_name = "Information and Ideas" if i % 2 == 0 else "Craft and Structure"
                if i % 4 == 0: topic_name = "Expression of Ideas"
                elif i % 4 == 1: topic_name = "Standard English Conventions"
                
                topic = topics[topic_name]
                body_text = f"Passage {i} for {diff} reading. A recent study suggests that local species adapt much faster than previously estimated. Environmental cues prompt rapid epigenetic shifts, allowing generations to survive sudden temperature variations.\n\nWhich choice best describes the main purpose of the passage?"
                correct = "A" if i % 4 == 0 else "B" if i % 4 == 1 else "C" if i % 4 == 2 else "D"
                
                q = Question(
                    body=body_text,
                    option_a="To argue that adaptation is driven mostly by temperature.",
                    option_b="To explain how epigenetic shifts facilitate rapid local adaptation.",
                    option_c="To question previous timelines regarding environmental adaptation.",
                    option_d="To compare the adaptation rates of different generations.",
                    correct_option=correct,
                    explanation=f"Choice {correct} is correct because the passage details the mechanism of rapid epigenetic shifts responding to environmental temperature variations.",
                    difficulty=diff,
                    topic_id=topic.id,
                    created_by=admin.id,
                    is_approved=True
                )
            else:
                # Math question
                topic_name = "Linear Equations and Functions" if i % 2 == 0 else "Systems of Linear Equations"
                if i % 4 == 0: topic_name = "Quadratic and Exponential Functions"
                elif i % 4 == 1: topic_name = "Geometry and Trigonometry"
                elif i % 4 == 2: topic_name = "Ratios, Rates, and Proportions"
                
                topic = topics[topic_name]
                
                # Check for Student Produced Response (SPR) - let's make last 3 questions of each math module SPR
                is_spr = (i >= count - 2)
                
                if is_spr:
                    val = f"{i * 2 + 3}"
                    body_text = f"Math Question {i} ({diff}): If 3x - 5 = {int(val) * 3 - 5}, what is the value of x?"
                    q = Question(
                        body=body_text,
                        correct_option=val,
                        explanation=f"Solving the linear equation: add 5 to both sides and divide by 3 to isolate x, giving x = {val}.",
                        difficulty=diff,
                        topic_id=topic.id,
                        created_by=admin.id,
                        is_approved=True
                    )
                else:
                    correct = "A" if i % 4 == 0 else "B" if i % 4 == 1 else "C" if i % 4 == 2 else "D"
                    body_text = f"Math Question {i} ({diff}): If f(x) = {i}x + 10, what is f(4)?"
                    ans_val = 4 * i + 10
                    options = {
                        "A": f"{ans_val if correct == 'A' else ans_val - 5}",
                        "B": f"{ans_val if correct == 'B' else ans_val + 3}",
                        "C": f"{ans_val if correct == 'C' else ans_val - 8}",
                        "D": f"{ans_val if correct == 'D' else ans_val + 12}"
                    }
                    
                    q = Question(
                        body=body_text,
                        option_a=options["A"],
                        option_b=options["B"],
                        option_c=options["C"],
                        option_d=options["D"],
                        correct_option=correct,
                        explanation=f"Substituting x = 4 into the function gives {i}(4) + 10 = {ans_val}, which corresponds to choice {correct}.",
                        difficulty=diff,
                        topic_id=topic.id,
                        created_by=admin.id,
                        is_approved=True
                    )
                    
            db.add(q)
            db.commit()
            db.refresh(q)
            
            # Link to module
            mq = ModuleQuestion(module_id=module_obj.id, question_id=q.id, display_order=i)
            db.add(mq)
            
        db.commit()
        print(f"Created and linked {count} questions for module {module_obj.id}")

    # Link Reading modules
    generate_and_link_questions(modules["reading_1_standard"], 27, "reading", "medium")
    generate_and_link_questions(modules["reading_2_easy"], 27, "reading", "easy")
    generate_and_link_questions(modules["reading_2_hard"], 27, "reading", "hard")
    
    # Link Math modules
    generate_and_link_questions(modules["math_3_standard"], 22, "math", "medium")
    generate_and_link_questions(modules["math_4_easy"], 22, "math", "easy")
    generate_and_link_questions(modules["math_4_hard"], 22, "math", "hard")

    db.close()
    print("Database seeding completed!")

if __name__ == "__main__":
    seed()
