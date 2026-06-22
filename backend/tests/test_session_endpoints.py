from fastapi.testclient import TestClient

from app.models.models import (
    Question,
    SessionAnswer,
    Test as SatTest,
    TestScore as SatTestScore,
    TestSession as SatTestSession,
    Topic,
    User,
)


def auth_headers(client: TestClient, email: str, password: str = "SecurePassword123!", role: str = "student"):
    client.post(
        "/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "role": role,
            "full_name": "Endpoint Test User",
        },
    )
    login = client.post("/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_get_score_returns_existing_score(client: TestClient, db):
    headers = auth_headers(client, "score_student@example.com")
    student = db.query(User).filter(User.email == "score_student@example.com").one()

    test = SatTest(name="Endpoint Mock", is_active=True)
    db.add(test)
    db.commit()
    db.refresh(test)

    session = SatTestSession(student_id=student.id, test_id=test.id, status="completed")
    db.add(session)
    db.commit()
    db.refresh(session)

    score = SatTestScore(
        session_id=session.id,
        reading_raw=40,
        reading_scaled=650,
        math_raw=35,
        math_scaled=680,
        total_score=1330,
        band_low=1300,
        band_high=1360,
        skill_breakdown={"Algebra": 80},
    )
    db.add(score)
    db.commit()

    response = client.get(f"/v1/sessions/{session.id}/score", headers=headers)

    assert response.status_code == 200
    assert response.json()["total_score"] == 1330


def test_get_session_review_returns_completed_answers(client: TestClient, db):
    headers = auth_headers(client, "review_student@example.com")
    student = db.query(User).filter(User.email == "review_student@example.com").one()

    test = SatTest(name="Review Mock", is_active=True)
    topic = Topic(name="Linear Equations", subject="math", skill_domain="Algebra")
    db.add_all([test, topic])
    db.commit()
    db.refresh(test)
    db.refresh(topic)

    question = Question(
        body="If x + 2 = 5, what is x?",
        option_a="3",
        option_b="4",
        option_c="5",
        option_d="7",
        correct_option="A",
        explanation="Subtract 2 from both sides.",
        difficulty="easy",
        topic_id=topic.id,
        is_approved=True,
    )
    session = SatTestSession(student_id=student.id, test_id=test.id, status="completed")
    db.add_all([question, session])
    db.commit()
    db.refresh(question)
    db.refresh(session)

    answer = SessionAnswer(
        session_id=session.id,
        question_id=question.id,
        module_no=1,
        selected_option="A",
        is_correct=True,
    )
    db.add(answer)
    db.commit()

    response = client.get(f"/v1/sessions/{session.id}/review", headers=headers)

    assert response.status_code == 200
    assert response.json()[0]["question_id"] == question.id
    assert response.json()[0]["is_correct"] is True
