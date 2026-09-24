import os
import sys
from openai import OpenAI

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.environ["NVIDIA_API_KEY"]
)

print("Starting streaming query with z-ai/glm-5.3...", flush=True)
try:
    completion = client.chat.completions.create(
        model="z-ai/glm-5.3",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Which number is larger, 9.11 or 9.8? Answer in one short sentence."}
        ],
        temperature=0.5,
        top_p=1,
        max_tokens=256,
        stream=True
    )

    full_response = ""
    for chunk in completion:
        if not chunk.choices:
            continue
        content = chunk.choices[0].delta.content
        if content:
            sys.stdout.write(content)
            sys.stdout.flush()
            full_response += content

    print("\n\nDone! Total chars:", len(full_response), flush=True)
except Exception as e:
    print(f"\nError: {e}", file=sys.stderr, flush=True)
