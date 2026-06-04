class SQLGenerator:
    def __init__(self):
        pass

    def generate_sql(self, natural_language_query: str) -> str:
        # Simulate translating a natural language query into a basic SQL query
        query_lower = natural_language_query.lower()
        if "sales" in query_lower and "today" in query_lower:
            return "SELECT SUM(amount) FROM sales WHERE date = CURRENT_DATE;"
        elif "top products" in query_lower:
            return "SELECT product_name, SUM(quantity) FROM sales GROUP BY product_name ORDER BY SUM(quantity) DESC LIMIT 10;"
        else:
            return "SELECT * FROM data LIMIT 10;"
