import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NotificationService } from '../services/notification.service';

// A new listing must come from the map's "add property" flow (click a spot, confirm, then land
// on 'listings/new' with ?lat&lng) — never rendered without coordinates, so nothing ever gets
// published at the (0,0) default the backend would otherwise silently store. Only applies to
// creating a listing; editing an existing one ('listings/:id/edit') is a separate route this
// guard is never attached to — its location is already known and loaded from the listing itself.
export const hasCoordinatesGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const notification = inject(NotificationService);

  const lat = Number(route.queryParamMap.get('lat'));
  const lng = Number(route.queryParamMap.get('lng'));

  if (route.queryParamMap.has('lat') && route.queryParamMap.has('lng') && Number.isFinite(lat) && Number.isFinite(lng)) {
    return true;
  }

  notification.error('listingForm.locationRequired');
  return router.parseUrl('/map');
};
