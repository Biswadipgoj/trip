import sys
from openai import OpenAI

try:
    client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key="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"
    )

    print("Connecting to NVIDIA API for model z-ai/glm-5.3...")
    completion = client.chat.completions.create(
        model="z-ai/glm-5.3",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Which number is larger, 9.11 or 9.8?"}
        ],
        temperature=0.5,
        top_p=1,
        max_tokens=1024,
        stream=False
    )

    print("Response received successfully:")
    print(completion.choices[0].message.content)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
