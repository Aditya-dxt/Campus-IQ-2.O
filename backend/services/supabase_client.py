from functools import lru_cache

from supabase import Client, create_client

from config import SUPABASE_KEY, SUPABASE_URL


@lru_cache
def get_supabase_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)
