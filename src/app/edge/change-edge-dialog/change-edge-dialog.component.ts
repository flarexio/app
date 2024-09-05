import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { 
  AbstractControl, FormControl, FormsModule, ReactiveFormsModule, 
  ValidationErrors, Validators, ValidatorFn 
} from '@angular/forms';
import { merge } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';

import { Edge, EdgeService } from '../../edge.service';

interface DialogData {
  edge: Edge;
}

@Component({
  selector: 'change-edge-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatDialogModule,
    MatInputModule,
  ],
  templateUrl: './change-edge-dialog.component.html',
  styleUrl: './change-edge-dialog.component.scss'
})
export class ChangeEdgeDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ChangeEdgeDialogComponent>);
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);
  readonly edge = this.data.edge;
  readonly name = new FormControl(this.edge.name, [
    Validators.required,
    valueChangedValidator(this.edge.name),
  ]);

  errorMessage = signal('');

  constructor(
    private edgeService: EdgeService,
  ) {
    merge(
      this.name.statusChanges, 
      this.name.valueChanges,
    ).pipe(
      takeUntilDestroyed()
    ).subscribe(() => this.updateErrorMessage());
  }

  changeName() {
    const newName = this.name.value;
    if (newName == null) {
      console.error(`invalid name`);
      return
    }

    const newEdge = this.edge.clone();
    newEdge.name = newName;

    this.edgeService.updateEdge(newEdge).subscribe({
      next: (edge) => console.log(edge),
      error: (err) => console.error(err),
      complete: () => this.dialogRef.close(),
    });
  }

  updateErrorMessage() {
    if (this.name.hasError('required')) {
      this.errorMessage.set('Name is required.');
    } else if (this.name.hasError('valueNotChanged')) {
      this.errorMessage.set('Name must be different.')
    } else {
      this.errorMessage.set('');
    }
  }
}

function valueChangedValidator(originalValue: any): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const currentValue = control.value;
    if (currentValue === originalValue) {
      return { valueNotChanged: true };
    }

    return null;
  };
}
