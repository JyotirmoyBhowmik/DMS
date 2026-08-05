import random
from typing import List, Dict

class Recommender:
    def __init__(self):
        pass

    def get_recommendations(self, user_id: str) -> List[str]:
        # Simulate collaborative filtering recommendations
        products = ["Product A", "Product B", "Product C", "Product D", "Product E"]
        return random.sample(products, 3)

    def calculate_churn_score(self, user_id: str) -> float:
        # Simulate churn scoring based on user activity
        churn_probability = random.uniform(0.0, 1.0)
        return round(churn_probability, 2)
