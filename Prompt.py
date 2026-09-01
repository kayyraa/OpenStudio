import os
import subprocess

Allowed = {"html", "js", "css"}
Prompt = []

for Root, _, Files in os.walk("."):
    for File in Files:
        Extension = os.path.splitext(File)[1].lower().lstrip(".")
        if Extension not in Allowed: continue

        Path = "/" + os.path.relpath(os.path.join(Root, File), ".").replace("\\", "/")

        with open(os.path.join(Root, File), "r", encoding="utf-8") as Content:
            Prompt.append(f"{Path}:\n{Content.read()}")

Prompt = "\n\n".join(Prompt)

subprocess.run(
    "clip",
    input=Prompt,
    text=True,
    shell=True,
    encoding="utf-8"
)