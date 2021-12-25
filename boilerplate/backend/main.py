from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from .utils.connect import execute_sql
from .utils.connect import read_as_dict

app = FastAPI()

app.mount('/static', StaticFiles(directory='dist', html=True), name='static')


@app.get('/')
async def root():
    return RedirectResponse('/static')


@app.get('/api/sample')
async def get_sample():
    result = execute_sql(
        'select * from test'
    )
    return read_as_dict(result)
