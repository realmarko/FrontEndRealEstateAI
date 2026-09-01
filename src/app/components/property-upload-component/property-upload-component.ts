import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PropertyService } from '../../core/services/property.service';

@Component({
  selector: 'app-property-upload-component',
  imports: [ReactiveFormsModule],
  templateUrl: './property-upload-component.html',
  styleUrl: './property-upload-component.css',
})
export class PropertyUploadComponent implements AfterViewInit {
  form: FormGroup;
  selectedFiles: File[] = [];
  @ViewChild('addressInput') addressInput!: ElementRef;

  constructor(private fb: FormBuilder, private propertyService: PropertyService) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      type: ['', Validators.required],
      operation: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      address: [''],
      neighborhood: [''],
      city: ['Puebla'],
      state: ['Puebla'],
      latitude: [0],
      longitude: [0],
      bedrooms: [0],
      bathrooms: [0],
      areaM2: [0],
      constructionM2: [0],
      parkingSpots: [0],
      yearBuilt: [null],
      agentId: [1, Validators.required]
    });
  }
  ngAfterViewInit() {
    const autocomplete = new google.maps.places.Autocomplete(
      this.addressInput.nativeElement,
      { componentRestrictions: { country: 'mx' } } // restringe a México
    );
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place.geometry || !place.geometry.location) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      // Extraer componentes (colonia, ciudad, estado)
      let neighborhood = '';
      let city = '';
      let state = '';

      place.address_components?.forEach(component => {
        if (component.types.includes('sublocality') || component.types.includes('neighborhood')) {
          neighborhood = component.long_name;
        }
        if (component.types.includes('locality')) {
          city = component.long_name;
        }
        if (component.types.includes('administrative_area_level_1')) {
          state = component.long_name;
        }
      });

      this.form.patchValue({
        address: place.formatted_address,
        latitude: lat,
        longitude: lng,
        neighborhood: neighborhood || this.form.value.neighborhood,
        city: city || this.form.value.city,
        state: state || this.form.value.state
      });
    });
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) this.selectedFiles = Array.from(input.files);
  }

  onSubmit() {
    if (this.form.invalid) return;

    const formData = new FormData();
    Object.entries(this.form.value).forEach(([key, value]) =>
      formData.append(key, value as string)
    );
    this.selectedFiles.forEach(file => formData.append('images', file));

    this.propertyService.createProperty(formData).subscribe({
      next: () => alert('Propiedad creada con éxito'),
      error: (err: any) => console.error(err)
    });
  }
}
