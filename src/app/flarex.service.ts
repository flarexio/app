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

  verifyNATSUserToken(code: string, id: string, token: string): Observable<string> {
    const params = { code, id, token };

    return this.http.patch(`${this.baseURL}/nats/user/token`, params).pipe(
      map((result) => result as string)
    )
  }
}
