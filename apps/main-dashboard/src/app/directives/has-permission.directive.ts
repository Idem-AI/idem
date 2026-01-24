import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, OnDestroy } from '@angular/core';
import { ProjectPermissionsService, type RolePermissions } from '@idem/shared-auth-client';
import { Subscription } from 'rxjs';

@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective implements OnInit, OnDestroy {
  @Input() appHasPermission!: keyof RolePermissions;

  private subscription?: Subscription;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionsService: ProjectPermissionsService,
  ) {}

  ngOnInit() {
    this.subscription = this.permissionsService.permissions$.subscribe((permissions) => {
      this.viewContainer.clear();

      if (permissions && permissions[this.appHasPermission]) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      }
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}
