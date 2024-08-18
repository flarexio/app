import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment as env } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FlarexService {
  private baseURL = env.FLAREX_CLOUD_BASEURL;

  constructor(
    private http: HttpClient,
  ) { }

  verifyToken(code: string, user: string, token: string): Observable<string> {
    const params = { code, user, token };

    return this.http.post(`${this.baseURL}/sessions/verify`, params).pipe(
      map((result) => result as string)
    )
  }
}
