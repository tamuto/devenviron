import json
import sqlalchemy

from sqlalchemy.sql import text


engine = sqlalchemy.create_engine(
    'mysql+pymysql://root:password@denv.host/sample?charset=utf8',
    echo=True)


def execute_sql(sql, params=None):
    return engine.execute(text(sql), params)


def read_as_dict(result):
    return [
        {
            column: value
            for column, value in row.items()
        } for row in result]


def to_json(data):
    return json.dumps(data, ensure_ascii=False)
