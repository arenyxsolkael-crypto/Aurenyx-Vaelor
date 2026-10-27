package org.aethervanguard.aurenyxvaelor

import android.app.Application
import org.aethervanguard.aurenyxvaelor.network.FirebaseAiLogicGateway

class VaelorApplication : Application() {

    lateinit var firebaseAiGateway: FirebaseAiLogicGateway
        private set

    override fun onCreate() {
        super.onCreate()
        firebaseAiGateway = FirebaseAiLogicGateway(this)
        // Install Play Integrity App Check automatically if a Firebase project is present
        firebaseAiGateway.installPlayIntegrityAppCheckIfConfigured()
    }
}
