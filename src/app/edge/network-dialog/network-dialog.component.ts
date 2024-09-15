import { AsyncPipe, JsonPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

import { Edge, EdgeService, NetworkInterface } from '../../edge.service';

@Component({
  selector: 'network-dialog',
  standalone: true,
  imports: [
    AsyncPipe,
    JsonPipe,
    MatButtonModule,
    MatDialogModule,
  ],
  templateUrl: './network-dialog.component.html',
  styleUrl: './network-dialog.component.scss'
})
export class NetworkDialogComponent {
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);
  readonly edge = this.data.edge;

  networks: Observable<NetworkInterface[] | undefined>;

  constructor(
    private edgeService: EdgeService,
  ) {
    this.networks = this.edgeService.networks(this.edge.id);
  }
}

interface DialogData {
  edge: Edge;
}
