from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

app = FastAPI()

app.mount('/static', StaticFiles(directory='dist', html=True), name='static')


@app.get('/')
async def root():
    return RedirectResponse('/static')