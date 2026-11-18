import { Global, Module } from '@nestjs/common';
import { JwtVerifierService } from './jwt-verifier.service';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { RolesService } from './roles.service';
import { Aal2Guard } from './aal2.guard';
import { FactoresMfaService } from './factores-mfa.service';

@Global()
@Module({
  providers: [
    JwtVerifierService,
    AuthGuard,
    RolesGuard,
    RolesService,
    Aal2Guard,
    FactoresMfaService,
  ],
  exports: [
    JwtVerifierService,
    AuthGuard,
    RolesGuard,
    RolesService,
    Aal2Guard,
    FactoresMfaService,
  ],
})
export class AuthModule {}
