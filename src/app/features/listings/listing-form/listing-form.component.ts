import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ListingService } from '../../../core/services/listing.service';

@Component({
  selector: 'app-listing-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './listing-form.component.html',
  styleUrl: './listing-form.component.css'
})
export class ListingFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly listingService = inject(ListingService);
  private readonly auth = inject(AuthService);

  private readonly editingId = this.route.snapshot.paramMap.get('id');
  readonly isEditMode = this.editingId !== null;

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    type: ['rent' as 'rent' | 'sale', Validators.required],
    address: ['', Validators.required],
    bedrooms: [1, [Validators.required, Validators.min(0)]],
    bathrooms: [1, [Validators.required, Validators.min(0)]],
    areaSqm: [0, [Validators.required, Validators.min(0)]],
    imageUrl: ['https://picsum.photos/640/400', Validators.required]
  });

  constructor() {
    if (this.editingId) {
      const listing = this.listingService.getById(this.editingId);
      if (listing) {
        this.form.patchValue(listing);
      }
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    if (this.editingId) {
      this.listingService.update(this.editingId, value);
      this.router.navigate(['/listings', this.editingId]);
      return;
    }

    const ownerId = this.auth.currentUser()?.id ?? 'anonymous';
    const created = this.listingService.create(value, ownerId);
    this.router.navigate(['/listings', created.id]);
  }
}
