from google import genai
import os
from dotenv import load_dotenv

# load env file
load_dotenv()

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

resp = client.models.generate_content(
    model="models/gemini-2.0-flash-exp",
    contents="Hello test"
)

print(resp)
