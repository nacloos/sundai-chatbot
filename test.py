import openai

openai_api_key = "sk-IrR7Bwxtin0haWagUnPrBgq5PurnUz86"
openai_api_base = "https://wxofjhjv5vx9mj-8000.proxy.runpod.net/v1/"

llm_client = openai.OpenAI(
    api_key=openai_api_key,
    base_url=openai_api_base,
)

model_name = "deepseek-ai/DeepSeek-R1"


top_p= 0.95
temperature = 0.7
messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is the capital of France?"},
]

generation = llm_client.chat.completions.create(
        model=model_name,
        messages=messages,
        stream=False,
        top_p=top_p,
        temperature=temperature,
    )

full_response = generation.choices[0].message.content

print(full_response)